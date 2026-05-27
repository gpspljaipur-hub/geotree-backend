import Certificate from "../models/certificate.model.js";
import Plantation from "../models/plantation.model.js";
import axios from "axios";
import crypto from "crypto";
import CertificateTemplate from "../models/certificateTemplate.model.js";
import Match from "../models/match.model.js";
import Team from "../models/team.model.js";
import PDFDocument from "pdfkit";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get certificate details
export const getCertificateDetails = asyncHandler(async (req, res) => {
  const { certificate_id, user_id } = getRequestParams(req, ['certificate_id', 'user_id']);

  // SECURITY FIX: Never use user_id from body for non-admin users
  const isAdmin = req.user?.type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const targetUserId = (isAdmin && user_id) ? user_id : req.user?.id;

  let certificate;
  if (certificate_id) {
    certificate = await Certificate.findOne({ certificate_id })
      .populate('user_id', 'name mobile email')
      .populate('plantation_id');

    // Additional check: If not admin, the certificate must belong to the user
    if (certificate && !isAdmin && String(certificate.user_id._id || certificate.user_id) !== String(req.user.id)) {
      throw new ApiError(403, "Access denied to this certificate");
    }
  } else if (targetUserId) {
    certificate = await Certificate.findOne({ user_id: targetUserId })
      .populate('user_id', 'name mobile email')
      .populate('plantation_id')
      .sort({ createdAt: -1 });
  } else {
    throw new ApiError(401, "Authentication required");
  }

  if (!certificate) throw new ApiError(404, "Certificate not found");

  res.json({
    status: true,
    message: "Certificate details fetched",
    data: certificate
  });
});

// @desc    Download certificate (Generates PDF)
export const downloadCertificate = asyncHandler(async (req, res) => {
  const { certificate_id } = getRequestParams(req, ['certificate_id']);
  if (!certificate_id) throw new ApiError(400, "certificate_id is required");

  // The actual certificate generation happens via HTML rendering in 'viewCertificate' 
  // method to support the admin-customizable templates. 
  // We redirect to the view HTML endpoint with a download flag,
  // which triggers the browser's print-to-PDF dialog matching the template perfectly.
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.redirect(`${baseUrl}/api/certificate/view/${certificate_id}?download=true`);
});

// @desc    Verify certificate via QR
export const verifyCertificate = asyncHandler(async (req, res) => {
  const { qr_code } = getRequestParams(req, ['qr_code']);
  if (!qr_code) throw new ApiError(400, "qr_code is required");

  const certificate = await Certificate.findOne({ qr_code })
    .populate('user_id', 'name mobile email')
    .populate('plantation_id');

  if (!certificate) throw new ApiError(404, "Invalid QR code or certificate not found");

  res.json({
    status: true,
    message: "Certificate verified",
    data: certificate
  });
});

// @desc    Get All Certificates (Admin)
export const getAllCertificates = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = getRequestParams(req, ['page', 'limit']);
  const skip = (Number(page) - 1) * Number(limit);

  const [certificates, total] = await Promise.all([
    Certificate.find()
      .populate('user_id', 'name email mobile')
      .populate('plantation_id', 'trees_count site_name date ipl_support source')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Certificate.countDocuments()
  ]);

  // Enrichment: Resolve Match Dates to ensure consistency in the List View
  const matchIds = certificates
    .filter(c => c.plantation_id?.ipl_support?.match_id)
    .map(c => c.plantation_id.ipl_support.match_id);

  if (matchIds.length > 0) {
    try {
      const matches = await Match.find({ _id: { $in: matchIds } }).select('match_name match_date').lean();
      const matchMap = new Map(matches.map(m => [m._id.toString(), m]));

      certificates.forEach(c => {
        const mid = c.plantation_id?.ipl_support?.match_id?.toString();
        const match = mid ? matchMap.get(mid) : null;
        if (match) {
          // Also set match_details if needed for other UI parts
          if (c.plantation_id.ipl_support) {
            c.plantation_id.ipl_support.match_details = {
              name: match.match_name,
              date: match.match_date
            };
          }
        }
      });
    } catch (e) {
      console.error("[getAllCertificates] Match enrichment error:", e.message);
    }
  }

  res.json({
    status: true,
    message: "Certificates fetched",
    data: certificates,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

// @desc    Get All Certificates for a specific User (App Users)
export const getUserCertificates = asyncHandler(async (req, res) => {
  const { user_id } = getRequestParams(req, ['user_id']);
  const { page = 1, limit = 10 } = getRequestParams(req, ['page', 'limit']);

  // SECURITY: By default use req.user.id for app users unless it is an admin requesting for someone else
  const isAdmin = req.user?.type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const targetUserId = (isAdmin && user_id) ? user_id : req.user?.id;

  if (!targetUserId) throw new ApiError(401, "Authentication required");

  const skip = (Number(page) - 1) * Number(limit);

  const [certificates, total] = await Promise.all([
    Certificate.find({ user_id: targetUserId })
      .populate('plantation_id', 'trees_count site_name date ipl_support source')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Certificate.countDocuments({ user_id: targetUserId })
  ]);

  // Enrichment: Resolve Match Dates and inject Certificate URL
  const matchIds = certificates
    .filter(c => c.plantation_id?.ipl_support?.match_id)
    .map(c => c.plantation_id.ipl_support.match_id);

  let matchMap = new Map();
  if (matchIds.length > 0) {
    try {
      const matches = await Match.find({ _id: { $in: matchIds } }).select('match_name match_date').lean();
      matchMap = new Map(matches.map(m => [m._id.toString(), m]));
    } catch (e) {
      console.error("[getUserCertificates] Match enrichment error:", e.message);
    }
  }

  certificates.forEach(c => {
    // Inject certificate viewing URL
    if (c.certificate_id) {
      c.certificate_url = `/api/certificate/view/${c.certificate_id}`;
    }

    const mid = c.plantation_id?.ipl_support?.match_id?.toString();
    const match = mid ? matchMap.get(mid) : null;
    if (match) {
      if (c.plantation_id.ipl_support) {
        c.plantation_id.ipl_support.match_details = {
          name: match.match_name,
          date: match.match_date
        };
      }
    }
  });

  res.json({
    status: true,
    message: "User certificates fetched successfully",
    data: certificates,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

// @desc    Manual Certificate Creation (Admin/Field)
export const createCertificate = asyncHandler(async (req, res) => {
  const { user_id, plantation_id, type } = req.body;
  if (!user_id || !plantation_id) throw new ApiError(400, "user_id and plantation_id required");

  // Check if certificate already exists
  const existing = await Certificate.findOne({ plantation_id });
  if (existing) {
    throw new ApiError(400, "Certificate already issued for this plantation");
  }

  // Auto-select category based on plantation data if not provided
  let finalType = type;
  if (!finalType) {
    const plantation = await Plantation.findById(plantation_id);
    if (plantation) {
      if (plantation.source === 'Occasion' || plantation.occasion_id) {
        finalType = 'Occasion';
      } else if (plantation.source === 'Carbon' || plantation.carbon_id) {
        finalType = 'Carbon Offset';
      } else if (plantation.source === 'Tournament' || plantation.ipl_support) {
        finalType = 'IPL Dot Ball';
      } else {
        finalType = 'Plantation';
      }
    }
  }

  const certificateId = `CERT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const qrCode = certificateId;

  const certificate = await Certificate.create({
    user_id,
    plantation_id,
    type: finalType || "Plantation",
    certificate_id: certificateId,
    qr_code: qrCode,
    date: new Date() // Store actual issuance date
  });

  res.status(201).json({ status: true, message: "Certificate created successfully", data: certificate });
});

// @desc    View Certificate (HTML Page)
export const viewCertificate = asyncHandler(async (req, res) => {
  const { certificate_id } = req.params;

  const certificate = await Certificate.findOne({ certificate_id })
    .populate('user_id', 'name mobile email')
    .populate({
      path: 'plantation_id',
      select: 'trees_count site_name date occasion_id source ipl_support tournament_id',
      populate: [
        { path: 'occasion_id', select: 'name' },
        { path: 'tournament_id', select: 'name' }
      ]
    });

  if (!certificate) {
    return res.status(404).send("<div style='text-align:center; padding:50px; font-family:sans-serif;'><h1>Certificate Not Found</h1><p>The link may be broken or the certificate has been removed.</p></div>");
  }

  // Find the template based on the certificate category (type)
  let template = await CertificateTemplate.findOne({
    type: { $regex: new RegExp(`^${certificate.type || 'Plantation'}$`, 'i') },
    status: true
  }).sort({ createdAt: -1 });

  // Fallback: if no specific template for that type exists, pick the latest active one
  if (!template) {
    console.log(`[CertificateView] No template found for type: ${certificate.type}. Falling back to default.`);
    template = await CertificateTemplate.findOne({ status: true }).sort({ createdAt: -1 });
  }

  if (!template) {
    return res.status(500).send("<h1>Certificate Template Missing</h1>");
  }

  let html = template.html_template;

  // Resolve path correctly relative to the project root
  if (html && html.startsWith('/uploads/')) {
    const cleanPath = html.startsWith('/') ? html.substring(1) : html;
    const searchPaths = [
      path.resolve(process.cwd(), 'public', cleanPath),
      path.resolve(process.cwd(), cleanPath),
      path.join(__dirname, '../public', cleanPath),
      path.join(__dirname, '../../public', cleanPath),
      path.join(process.cwd(), 'backend', 'geotree_final', 'public', cleanPath)
    ];

    let fileFound = false;
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        html = fs.readFileSync(p, 'utf-8');
        fileFound = true;
        break;
      }
    }

    if (!fileFound) {
      console.error(`[CertificateView] Template file not found: ${html}`);
      html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;">
                <h1 style="color:#e11d48;">Template Missing</h1>
                <p>Could not locate the template file on the server. Please check if the template was correctly uploaded.</p>
                <div style="font-size:11px; color:#999; margin-top:20px;">Ref: ${html}</div>
              </body></html>`;
    }
  }

  // Data to inject
  const userName = certificate.user_id?.name || "Valued User";
  const treesCount = certificate.plantation_id?.trees_count || 0;
  const siteName = certificate.plantation_id?.site_name || "GeoTree Site";

  // Distinction: issuanceDate vs eventDate
  // issue_date is when this PDF was generated for the user
  const issueDateObj = certificate.date || certificate.createdAt || new Date();
  const issueDateStr = new Date(issueDateObj).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // event_date is when the actual match or plantation happened
  let eventDateObj = certificate.plantation_id?.date || certificate.plantation_id?.createdAt || issueDateObj;
  let eventDateStr = new Date(eventDateObj).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Escape function for security
  const esc = (val) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  // Resolve the specific occasion or initiative name
  let occasionName = "Special Occasion";
  let tournamentName = "The Tournament";
  let teamName = "Supported Team";
  const p = certificate.plantation_id;

  if (p) {
    // Resolve Team Name
    if (p.ipl_support?.team_display?.team_name || p.ipl_support?.team_name) {
      teamName = p.ipl_support.team_display?.team_name || p.ipl_support.team_name;
    } else if (p.ipl_support?.team_id) {
      try {
        const team = await Team.findById(p.ipl_support.team_id).select('team_name').lean();
        if (team) teamName = team.team_name;
      } catch (e) {
        console.error("[CertificateView] Team resolve error:", e.message);
      }
    }

    // Resolve Tournament Name
    if (p.tournament_id?.name) {
      tournamentName = p.tournament_id.name;
    } else if (p.ipl_support?.tournament_name) {
      tournamentName = p.ipl_support.tournament_name;
    } else if (p.source === 'IPL Dot Ball' || p.source === 'Tournament' || p.ipl_support) {
      tournamentName = "IPL 2024"; // Standard fallback for this project
    }

    if (p.occasion_id?.name) {
      occasionName = p.occasion_id.name;
    } else if (p.source === 'Tournament' || p.source === 'IPL Dot Ball' || p.ipl_support) {
      // Resolve Match Name & Date
      const matchId = p.ipl_support?.match_id;
      if (matchId) {
        try {
          const match = await Match.findById(matchId).populate('team1_id team2_id').lean();
          if (match) {
            occasionName = `${match.team1_id?.team_short_name || match.team1_id?.team_name || "Team 1"} vs ${match.team2_id?.team_short_name || match.team2_id?.team_name || "Team 2"}`;
            // Use match date for event context
            if (match.match_date) {
              const mDate = new Date(match.match_date);
              eventDateStr = mDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            }
          } else {
            occasionName = p.ipl_support?.match_details?.name;
          }
        } catch (e) {
          occasionName = "Green Match Initiative";
        }
      } else {
        // For team-level support, we don't have a specific match pairing
        // We'll use a more generic title instead of the tournament name fallback
        occasionName = "IPL Green Initiative";
      }
    } else if (p.source === 'Carbon') {
      occasionName = "Carbon Offset Contribution";
    } else if (p.source === 'Occasion') {
      // Check if name was stored in Top-level name field (often used in manual entry)
      occasionName = p.name || "Special Event";
    }
  }

  // 1. Process the template's own fields (they might contain placeholders themselves like {{recipient}})
  let description = template.description || "";
  const varMap = {
    '{{recipient}}': esc(userName),
    '{{user_name}}': esc(userName),
    '{{qty}}': treesCount,
    '{{trees_count}}': treesCount,
    '{{site}}': esc(siteName),
    '{{site_name}}': esc(siteName),
    '{{impact}}': `${treesCount * 0.25} Tonnes CO2e`, // Estimated 0.25 tonnes per tree over lifetime
    '{{occasion}}': esc(occasionName),
    '{{tournament}}': esc(tournamentName),
    '{{occasion}}': esc(occasionName),
    '{{tournament}}': esc(tournamentName),
    '{{date}}': issueDateStr, // Standardized: {{date}} is now the Issuance Date (matches Admin Table)
    '{{issue_date}}': issueDateStr,
    '{{event_date}}': eventDateStr, // Specifically for the match/plantation day
    '{{match_date}}': eventDateStr,
    '{{CERTIFICATE_ID}}': certificate.certificate_id,
    '{{team}}': esc(teamName),
    '{{match}}': esc(occasionName),
    '{{dot_balls}}': p?.ipl_support?.initial_dot_balls || p?.ipl_support?.dot_balls || treesCount || "0",
    '{{trees_planted}}': treesCount,
  };

  Object.keys(varMap).forEach(key => {
    description = description.split(key).join(varMap[key]);
  });

  // 2. Map all template and certificate fields to placeholders
  const replacements = {
    ...varMap,
    '{{title}}': esc(template.title),
    '{{subTitle}}': esc(template.subTitle),
    '{{description}}': description, // This allows HTML if stored in description
    '{{tagline}}': esc(template.tagline),
    '{{primaryColor}}': template.primaryColor || '#1e5c38',
    '{{previewImage}}': template.previewImage || '',
    '{{previewImageClass}}': (template.previewImage && !template.previewImage.startsWith('/') && !template.previewImage.startsWith('http')) ? template.previewImage : '',
    '{{previewImageStyle}}': (template.previewImage && (template.previewImage.startsWith('/') || template.previewImage.startsWith('http'))) ? `url(${template.previewImage})` : 'none',

    // Legacy / Specifics Caps
    '{{USER_NAME}}': esc(userName),
    '{{TREES_COUNT}}': treesCount,
    '{{SITE_NAME}}': esc(siteName),
    '{{DATE}}': issueDateStr,
    '{{ISSUE_DATE}}': issueDateStr,
    '{{EVENT_DATE}}': eventDateStr,
    '{{certificate_id}}': certificate.certificate_id,
  };

  // Perform replacements safely using split/join to avoid regex special character issues (like {{ }})
  Object.keys(replacements).forEach(key => {
    if (typeof html === 'string') {
      html = html.split(key).join(replacements[key]);
    }
  });

  // 3. Handle QR Code injection if placeholder exists
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(certificate.qr_code || certificate.certificate_id)}`;
  if (typeof html === 'string') {
    if (html.includes('{{qr_code}}')) {
      html = html.replace(/{{qr_code}}/g, `<img src="${qrImage}" alt="QR Code" style="max-width:100%"/>`);
    } else {
      // Robust regex to find any div with class "qr-code" and replace its content
      html = html.replace(/<div([^>]*class="[^"]*qr-code[^"]*"[^>]*)><\/div>/g,
        `<div$1><img src="${qrImage}" alt="QR Code" style="width:100%; height:100%; object-fit:contain;"/></div>`);
    }
  }

  if (req.query.print === 'true') {
    html += '<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }</script>';
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// @desc    Update certificate record
export const updateCertificate = asyncHandler(async (req, res) => {
  const id = req.body.id || req.body.certificate_id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "ID is required");

  const certificate = await Certificate.findByIdAndUpdate(id, req.body, { new: true });
  if (!certificate) throw new ApiError(404, "Certificate not found");

  res.json({ status: true, message: "Certificate updated", data: certificate });
});

// @desc    Delete certificate record
export const deleteCertificate = asyncHandler(async (req, res) => {
  const id = req.body.id || req.body.certificate_id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "ID is required");

  const certificate = await Certificate.findByIdAndDelete(id);
  if (!certificate) throw new ApiError(404, "Certificate not found");

  res.json({ status: true, message: "Certificate deleted successfully" });
});
