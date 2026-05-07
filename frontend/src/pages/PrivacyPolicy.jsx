import { Link } from "react-router-dom";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2
      className="font-display font-bold text-xl mb-3"
      style={{ color: "var(--text-primary)" }}
    >
      {title}
    </h2>
    <div
      className="text-sm leading-relaxed space-y-3"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </div>
  </div>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-[calc(100vh-64px)] px-4 py-12">
      <div className="max-w-3xl mx-auto animate-slide-up">
        {/* Header */}
        <div className="mb-10">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: "#ff4655" }}
          >
            Legal
          </p>
          <h1
            className="font-display font-bold text-4xl mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Privacy Policy
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Last updated:{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Card */}
        <div className="card space-y-2">
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            ArenaX ("we", "us", or "our") is committed to protecting your
            personal data. This Privacy Policy explains what information we
            collect, how we use it, and your rights regarding your data when you
            use the ArenaX platform.
          </p>

          <Section title="1. Information We Collect">
            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                Account data:
              </strong>{" "}
              When you register, we collect your username, email address, and
              hashed password.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                Profile data:
              </strong>{" "}
              Optional information such as your avatar, bio, favourite games,
              and social links that you choose to add to your public profile.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                Usage data:
              </strong>{" "}
              Log data including your IP address, browser type, pages visited,
              and interactions with the platform (e.g. tournaments joined, teams
              created).
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                Communications:
              </strong>{" "}
              Messages sent via in-platform community or team chat features.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>To create and manage your account.</li>
              <li>
                To operate tournaments, matchmaking, and leaderboard features.
              </li>
              <li>
                To display your public profile and stats to other users (as per
                your privacy settings).
              </li>
              <li>
                To send service-related emails such as account verification and
                password resets.
              </li>
              <li>
                To detect and prevent fraud, cheating, or abuse of the platform.
              </li>
              <li>
                To improve platform performance and user experience through
                analytics.
              </li>
            </ul>
            <p>
              We do{" "}
              <strong style={{ color: "var(--text-primary)" }}>not</strong> sell
              your personal data to third parties.
            </p>
          </Section>

          <Section title="3. Cookies &amp; Local Storage">
            <p>
              ArenaX uses browser storage (localStorage and session tokens) to
              keep you logged in and remember your theme preference. We may also
              use lightweight analytics cookies to understand how users navigate
              the platform.
            </p>
            <p>
              You can clear cookies at any time via your browser settings.
              Disabling cookies may limit certain platform features.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p>
              We do not sell or rent your personal information. We may share
              limited data with trusted third-party service providers who assist
              in operating the platform (e.g. cloud hosting, email delivery)
              strictly for that purpose and under confidentiality agreements.
            </p>
            <p>
              We may disclose data if required to do so by law or in response to
              valid legal requests.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account data for as long as your account is active.
              If you delete your account, we will remove your personal data
              within 30 days, except where retention is required by law or for
              legitimate business purposes (e.g. fraud prevention records).
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We implement industry-standard security practices including
              password hashing (bcrypt), JWT-based authentication, and HTTPS
              encryption in transit.
            </p>
            <p>
              While we take reasonable steps to protect your data, no internet
              transmission is completely secure. We cannot guarantee the
              absolute security of your information.
            </p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              ArenaX is not intended for children under the age of 13. We do not
              knowingly collect personal information from children under 13. If
              you believe we have inadvertently collected such information,
              please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Object to or restrict certain processing of your data.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{" "}
              <a
                href="mailto:privacy@arenax.gg"
                className="font-medium transition-colors"
                style={{ color: "#ff4655" }}
              >
                privacy@arenax.gg
              </a>
              .
            </p>
          </Section>

          <Section title="9. Third-Party Links">
            <p>
              ArenaX may contain links to external websites or game platforms.
              We are not responsible for the privacy practices of those sites.
              We encourage you to review their privacy policies before providing
              any personal information.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. We will notify you
              of significant changes via email or an in-app banner. Your
              continued use of ArenaX after any changes constitutes your
              acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy,
              contact us at{" "}
              <a
                href="mailto:privacy@arenax.gg"
                className="font-medium transition-colors"
                style={{ color: "#ff4655" }}
              >
                privacy@arenax.gg
              </a>
              .
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div
          className="flex justify-center gap-6 mt-8 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <Link
            to="/terms"
            className="hover:underline transition-colors"
            style={{ color: "#ff4655" }}
          >
            Terms &amp; Conditions
          </Link>
          <span>·</span>
          <Link to="/" className="hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
