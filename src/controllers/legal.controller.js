// legal.controller.js

export const getPrivacyPolicy = (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy | GeoTree</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10B981;
            --primary-dark: #059669;
            --primary-light: #D1FAE5;
            --secondary: #3B82F6;
            --dark: #1F2937;
            --light: #F9FAFB;
            --gray: #6B7280;
            --white: #FFFFFF;
            --border: #E5E7EB;
            --bg-gradient: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Outfit', sans-serif;
            line-height: 1.6;
            color: var(--dark);
            background: var(--bg-gradient);
            background-attachment: fixed;
            min-height: 100vh;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 850px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 3rem;
            border-radius: 24px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
            border: 1px solid var(--white);
        }

        header {
            text-align: center;
            margin-bottom: 4rem;
            border-bottom: 2px solid var(--primary-light);
            padding-bottom: 2rem;
        }

        .logo {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .logo svg {
            width: 40px;
            height: 40px;
        }

        h1 {
            font-size: 2.25rem;
            color: var(--dark);
            margin-bottom: 1rem;
            font-weight: 700;
        }

        .effective-date {
            color: var(--gray);
            font-size: 0.95rem;
            font-weight: 500;
        }

        h2 {
            font-size: 1.5rem;
            color: var(--primary-dark);
            margin: 2.5rem 0 1.25rem;
            border-left: 4px solid var(--primary);
            padding-left: 1rem;
            font-weight: 600;
        }

        h3 {
            font-size: 1.15rem;
            color: var(--dark);
            margin: 1.5rem 0 1rem;
            font-weight: 600;
        }

        p {
            margin-bottom: 1.25rem;
            color: #4B5563;
            text-align: justify;
        }

        ul {
            margin-bottom: 1.5rem;
            padding-left: 1.5rem;
            list-style-type: none;
        }

        ul li {
            margin-bottom: 0.75rem;
            position: relative;
            padding-left: 1.5rem;
            color: #4B5563;
        }

        ul li::before {
            content: "•";
            color: var(--primary);
            font-weight: bold;
            display: inline-block;
            width: 1em;
            margin-left: -1.5rem;
            font-size: 1.2rem;
            position: absolute;
        }

        .contact-info {
            background: var(--light);
            padding: 2rem;
            border-radius: 16px;
            margin-top: 3rem;
            border: 1px solid var(--border);
        }

        .contact-info p {
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        .contact-info a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
            transition: color 0.2s ease;
        }

        .contact-info a:hover {
            color: var(--primary-dark);
            text-decoration: underline;
        }

        .section-card {
            margin-bottom: 3rem;
        }

        .highlight {
            color: var(--primary-dark);
            font-weight: 600;
        }

        @media (max-width: 640px) {
            .container {
                padding: 1.5rem;
                border-radius: 16px;
            }
            h1 {
                font-size: 1.75rem;
            }
            body {
                padding: 1rem 0.5rem;
            }
        }

        /* Scrollbar styles */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--light);
        }
        ::-webkit-scrollbar-thumb {
            background: #D1D5DB;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #9CA3AF;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                GeoTree
            </div>
            <h1>Privacy Policy</h1>
            <p class="effective-date">Effective Date: 16 March 2026</p>
        </header>

        <div class="intro">
            <p>GeoTree operates the GeoTree mobile application and website related services. This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.</p>
            <p>We use Your Personal Data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.</p>
        </div>

        <section class="section-card">
            <h2>1. Collecting and Using Your Personal Data</h2>
            
            <h3>Types of Data Collected</h3>
            
            <p class="highlight">Personal Data</p>
            <p>While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. Personally identifiable information may include, but is not limited to:</p>
            <ul>
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Location</li>
                <li>Phone Number</li>
                <li>Profile Information</li>
                <li>Login credentials</li>
            </ul>

            <p class="highlight">Environmental Activity Data</p>
            <p>To provide our services we may collect:</p>
            <ul>
                <li>Number of trees planted</li>
                <li>Tree plantation location (GPS coordinates)</li>
                <li>Carbon offset calculations</li>
                <li>Plantation photos uploaded by users</li>
                <li>Tree verification data</li>
            </ul>

            <p class="highlight">Device Information</p>
            <p>We may automatically collect:</p>
            <ul>
                <li>Device type</li>
                <li>Operating system</li>
                <li>IP address</li>
                <li>App usage data</li>
                <li>Crash reports</li>
            </ul>

            <p class="highlight">Location Data</p>
            <p>GeoTree may request access to your device location to:</p>
            <ul>
                <li>Record tree plantation coordinates</li>
                <li>Display tree locations on maps</li>
                <li>Calculate environmental impact</li>
            </ul>
            <p>Location access is optional and can be disabled anytime in device settings.</p>

            <p class="highlight">Usage Data</p>
            <p>Usage Data is collected automatically when using the Service. It may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</p>
        </section>

        <section class="section-card">
            <h2>2. Information Collected while Using the Application</h2>
            <p>While using Our Application, in order to provide features of Our Application, We may collect, with Your prior permission:</p>
            <ul>
                <li>Information regarding your location</li>
                <li>Pictures and other information from your Device's camera and photo library</li>
            </ul>
            <p>We use this information to provide features of Our Service, to improve and customize Our Service. The information may be uploaded to the Company's servers and/or a Service Provider's server or it may be simply stored on Your device. You can enable or disable access to this information at any time through Your Device settings.</p>
        </section>

        <section class="section-card">
            <h2>3. Tracking Technologies and Cookies</h2>
            <p>We use Cookies and similar tracking technologies to track the activity on Our Service and store certain information. Tracking technologies We use include beacons, tags, and scripts to collect and track information and to improve and analyze Our Service.</p>
            
            <h3>Cookies we use:</h3>
            <ul>
                <li><strong>Necessary / Essential Cookies:</strong> These help to authenticate users and prevent fraudulent use of user accounts.</li>
                <li><strong>Cookies Policy / Notice Acceptance Cookies:</strong> These identify if users have accepted the use of cookies on the Website.</li>
                <li><strong>Functionality Cookies:</strong> These allow Us to remember choices You make when You use the Website, such as remembering your login details.</li>
            </ul>
        </section>

        <section class="section-card">
            <h2>4. Use of Your Personal Data</h2>
            <p>The Company may use Personal Data for the following purposes:</p>
            <ul>
                <li>To provide and maintain our Service, including to monitor usage.</li>
                <li>To manage Your Account: giving You access to different functionalities available to registered users.</li>
                <li>To contact You: By email, telephone, SMS, or other equivalent forms of electronic communication.</li>
                <li>To provide You with news, special offers, and general information about other goods, services and events.</li>
                <li>To manage Your requests: To attend and manage Your requests to Us.</li>
            </ul>
        </section>

        <section class="section-card">
            <h2>5. Retention of Your Personal Data</h2>
            <p>The Company will retain Your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We apply different retention periods:</p>
            <ul>
                <li><strong>User Accounts:</strong> Duration of account relationship plus up to 24 months after closure.</li>
                <li><strong>Support tickets & Correspondence:</strong> Up to 24 months from ticket closure.</li>
                <li><strong>Usage Data & Analytics:</strong> Up to 24 months from date of collection.</li>
            </ul>
        </section>

        <section class="section-card">
            <h2>6. Transfer & Deletion of Your Personal Data</h2>
            <p>Your information is processed at the Company's operating offices and in any other places where the parties involved in the processing are located. We take all steps reasonably necessary to ensure that Your data is treated securely.</p>
            <p>You have the right to delete or request that We assist in deleting the Personal Data that We have collected about You. You may update, amend, or delete Your information at any time by signing in to Your Account.</p>
        </section>

        <section class="section-card">
            <h2>7. Children's Privacy</h2>
            <p>Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If we become aware that we have collected Personal Data from anyone under the age of 13 without verification of parental consent, we take steps to remove that information from our servers.</p>
        </section>

        <section class="section-card">
            <h2>8. Security of Your Personal Data</h2>
            <p>The security of Your Personal Data is important to Us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While We strive to use commercially reasonable means to protect Your Personal Data, We cannot guarantee its absolute security.</p>
        </section>

        <div class="contact-info">
            <h2>Contact Us</h2>
            <p>If you have any questions regarding this Privacy Policy, please contact us:</p>
            <p><strong>GeoTree Support Team</strong></p>
            <p>Email: <a href="mailto:info@geoplanetsolution.com">info@geoplanetsolution.com</a></p>
            <p>Website: <a href="https://geotree.in/" target="_blank">https://geotree.in/</a></p>
        </div>
    </div>
</body>
</html>
  `;
    res.send(html);
};
