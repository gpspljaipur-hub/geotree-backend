import nodemailer from 'nodemailer';

/**
 * FIX: Transporter is created ONCE as a module-level singleton.
 * Previously it was created on every sendEmail() call, opening a new TLS
 * connection each time. The singleton reuses the same SMTP connection pool.
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT == 465, // true for 465 (SSL), false for 587 (STARTTLS)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        pool: true,          // Use connection pooling for better performance
        maxConnections: 5,   // Max simultaneous SMTP connections
        maxMessages: 100,    // Max messages per connection before reconnecting
    });
};

// Singleton instance — created once, reused for all emails
let _transporter = null;

const getTransporter = () => {
    if (!_transporter) {
        _transporter = createTransporter();
    }
    return _transporter;
};

/**
 * Send an email using SMTP configuration from environment variables.
 * @param {{ to: string, subject: string, html: string }} options
 */
export const sendEmail = async ({ to, subject, html }) => {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"GeoTree" <no-reply@geotree.com>',
        to,
        subject,
        html,
    });

    if (process.env.NODE_ENV === 'development') {
        console.log("Email sent: %s", info.messageId);
        // Provide preview URL if using Ethereal (local dev SMTP)
        if (process.env.EMAIL_HOST?.includes('ethereal')) {
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        }
    }

    return info;
};
