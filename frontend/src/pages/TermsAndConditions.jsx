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

export default function TermsAndConditions() {
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
            Terms &amp; Conditions
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
            Welcome to{" "}
            <strong style={{ color: "var(--text-primary)" }}>ArenaX</strong>. By
            accessing or using our platform, you agree to be bound by these
            Terms &amp; Conditions. Please read them carefully before creating
            an account or participating in any activity on ArenaX.
          </p>

          <Section title="1. Eligibility">
            <p>
              You must be at least{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                13 years of age
              </strong>{" "}
              to use ArenaX. If you are under 18, you confirm that a parent or
              legal guardian has reviewed and agreed to these terms on your
              behalf.
            </p>
            <p>
              By registering, you represent that all information you provide is
              accurate, current, and complete.
            </p>
          </Section>

          <Section title="2. Account Responsibilities">
            <p>
              You are solely responsible for maintaining the confidentiality of
              your account credentials. Any activity that occurs under your
              account is your responsibility.
            </p>
            <p>
              You agree not to share your account, impersonate another person,
              or create accounts through automated means.
            </p>
            <p>
              ArenaX reserves the right to suspend or terminate accounts that
              violate these terms at any time, without prior notice.
            </p>
          </Section>

          <Section title="3. Acceptable Use">
            <p>
              You agree{" "}
              <strong style={{ color: "var(--text-primary)" }}>not</strong> to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                Post or transmit hateful, abusive, or harassing content toward
                other users.
              </li>
              <li>
                Cheat, exploit bugs, or use unauthorized software in tournaments
                or matches.
              </li>
              <li>
                Spam, advertise, or solicit other users without prior written
                consent from ArenaX.
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the platform
                or its underlying infrastructure.
              </li>
              <li>
                Upload content that infringes intellectual property rights of
                any third party.
              </li>
            </ul>
          </Section>

          <Section title="4. Tournaments &amp; Prize Pools">
            <p>
              Tournament participation is subject to specific rules published
              for each event. Prize pools, eligibility criteria, and payout
              timelines are governed by those rules.
            </p>
            <p>
              ArenaX reserves the right to disqualify participants, adjust
              brackets, or cancel tournaments due to technical issues,
              misconduct, or circumstances beyond our control. Prize decisions
              made by ArenaX administrators are final.
            </p>
          </Section>

          <Section title="5. User-Generated Content">
            <p>
              By posting content (profile info, streams, community posts, etc.)
              on ArenaX, you grant us a non-exclusive, royalty-free, worldwide
              licence to use, display, and distribute that content for the
              purpose of operating the platform.
            </p>
            <p>
              You retain ownership of your content. You are responsible for
              ensuring you have the right to post any content you upload.
            </p>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              The ArenaX name, logo, design, and platform code are the
              intellectual property of ArenaX and its licensors. You may not
              copy, modify, or distribute any part of the platform without our
              express written permission.
            </p>
            <p>
              Game names, logos, and trademarks referenced on this platform
              belong to their respective owners. ArenaX is not affiliated with
              or endorsed by any game publisher unless explicitly stated.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              ArenaX is provided on an "as is" basis. We make no warranties of
              any kind, express or implied, regarding uptime, data accuracy, or
              fitness for a particular purpose.
            </p>
            <p>
              To the maximum extent permitted by law, ArenaX shall not be liable
              for any indirect, incidental, or consequential damages arising
              from your use of the platform.
            </p>
          </Section>

          <Section title="8. Modifications to Terms">
            <p>
              We may update these Terms from time to time. We will notify
              registered users of material changes via email or an in-app
              notice. Continued use of ArenaX after changes take effect
              constitutes your acceptance of the updated terms.
            </p>
          </Section>

          <Section title="9. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the
              laws of India. Any disputes shall be subject to the exclusive
              jurisdiction of the courts located in India.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a
                href="mailto:legal@arenax.gg"
                className="font-medium transition-colors"
                style={{ color: "#ff4655" }}
              >
                legal@arenax.gg
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
            to="/privacy"
            className="hover:underline transition-colors"
            style={{ color: "#ff4655" }}
          >
            Privacy Policy
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
