import { Link } from "react-router-dom";
import SEO from "../components/SEO";

// Bump this whenever the wording changes. Deliberately a fixed date, not
// new Date(): a legal page that always says "updated today" is worthless as a record.
const LAST_UPDATED = "4 October 2026";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-display font-bold text-xl mb-3" style={{ color: "var(--text-primary)" }}>
      {title}
    </h2>
    <div className="text-sm leading-relaxed space-y-3" style={{ color: "var(--text-secondary)" }}>
      {children}
    </div>
  </div>
);

const Strong = ({ children }) => (
  <strong style={{ color: "var(--text-primary)" }}>{children}</strong>
);

// NOTE: the numbers that admins can change (coin prices, exchange rate, earn
// amounts, monthly redemption limit, minimum account age, holding period) are
// intentionally NOT hard-coded here. The Rewards page always shows the live
// values, so this page never goes out of date when an admin edits a setting.
export default function RewardsTerms() {
  return (
    <div className="min-h-[calc(100vh-64px)] px-4 py-12">
      <SEO
        title="Arena Coins Rewards Terms"
        description="The rules for earning and redeeming Arena Coins on ArenaX: eligibility, redemption, fair play, and how rewards are delivered."
        path="/rewards-terms"
      />
      <div className="max-w-3xl mx-auto animate-slide-up">
        <div className="mb-10">
          <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color: "#ff4655" }}>
            Legal
          </p>
          <h1 className="font-display font-bold text-4xl mb-3" style={{ color: "var(--text-primary)" }}>
            Arena Coins Rewards Terms
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="card space-y-2">
          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            These terms explain how Arena Coins work on <Strong>ArenaX</Strong>. They apply in
            addition to our{" "}
            <Link to="/terms" className="font-medium" style={{ color: "#ff4655" }}>
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="font-medium" style={{ color: "#ff4655" }}>
              Privacy Policy
            </Link>
            . If the two ever conflict on a question about Arena Coins, these Rewards Terms
            apply. By earning or redeeming Arena Coins, you agree to them.
          </p>

          <Section title="1. What Arena Coins are">
            <p>
              Arena Coins are a loyalty reward for taking part in ArenaX. You earn them by being
              active on the platform and can exchange them for rewards from our catalogue.
            </p>
            <p>
              Coins can <Strong>only be earned</Strong>. They cannot be bought, and no payment,
              wager or stake is needed to earn them. They cannot be used as an entry fee, stake or
              prize pool contribution for any tournament or game.
            </p>
          </Section>

          <Section title="2. Earning coins">
            <p>
              You can earn coins for activities such as logging in each day, playing a Dailies
              game, completing your profile, adding your first game, joining a team, keeping a
              login streak, and playing in a completed tournament (your team must be checked in by the
              organizer, and only tournaments run by verified organizers pay coins). The activities and the amount each one pays are shown on the{" "}
              <Link to="/rewards" className="font-medium" style={{ color: "#ff4655" }}>
                Rewards page
              </Link>{" "}
              and may change over time.
            </p>
            <p>
              Some activities pay once per day, and profile, first-game and team-join rewards pay
              once per account. Some coins, such as those for joining a team, are held as{" "}
              <Strong>pending</Strong> for a short period and are released only if the conditions
              still hold, for example you are still a member of that team. If they do not, those
              coins are cancelled.
            </p>
          </Section>

          <Section title="3. ArenaX Pro members">
            <p>
              Active ArenaX Pro members earn a multiplier on selected activities. A monthly cap
              applies to the extra coins the multiplier adds. The current multiplier, the activities
              it applies to and the cap are shown on the Rewards page. Coins you earn without the
              multiplier are not affected if your Pro membership ends.
            </p>
          </Section>

          <Section title="4. Coins have no cash value">
            <p>
              Arena Coins are not money, not a financial product and not your property. They have no
              cash value, cannot be sold, traded, gifted or transferred between accounts, and cannot
              be withdrawn as cash. A reward you redeem is a promotional benefit from ArenaX.
            </p>
          </Section>

          <Section title="5. Redeeming rewards">
            <p>
              The catalogue may include ArenaX Pro days, gift cards and in-game top-ups. Each reward
              shows its price in coins. The price of gift cards and top-ups is calculated from a coin
              exchange rate that we may change. A change applies to future redemptions only. A
              redemption you have already requested is never repriced.
            </p>
            <p>
              Redeeming takes the coins from your balance straight away. ArenaX Pro days are
              applied to your account immediately. Gift cards and top-ups are{" "}
              <Strong>reviewed by our team</Strong> before they are delivered. Rewards are limited
              by stock, and we may add, change or remove rewards, or pause redemptions, at any time. We may also
              limit how many gift cards and top-ups we can offer in a month. If that limit is
              reached, new requests are declined until the next month and your coins are not taken.
            </p>
            <p>
              If we reject a request, for example because it fails a fair-play check or the reward
              cannot be supplied, the coins are returned to your balance.
            </p>
          </Section>

          <Section title="6. Who can redeem">
            <p>To redeem gift cards and top-ups, your account must:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>be in good standing, with no active ban or suspension;</li>
              <li>have a verified email address;</li>
              <li>be older than the minimum account age; and</li>
              <li>be within the monthly limit on gift card and top-up redemptions.</li>
            </ul>
            <p>
              The minimum account age and the monthly limit are shown on the Rewards page and may
              change. A request that we reject does not count towards the monthly limit.
            </p>
          </Section>

          <Section title="7. How rewards are delivered">
            <p>
              Gift card codes and top-up details are delivered to you inside your account on the
              Rewards page. We email you when a request is fulfilled or rejected, but we never put
              the code itself in an email. Keep your login secure. We are not responsible for a code
              that is lost, shared or used by someone with access to your account.
            </p>
            <p>
              Gift cards and top-ups are issued by third parties and are subject to their own terms,
              expiry dates and regional restrictions. If a code you received does not work, or a
              request has not arrived after 3 days, use <Strong>Report a problem</Strong> next to
              that reward on the Rewards page. We will replace the code, refund your coins, or
              tell you what we found. You can also write to{" "}
              <a href="mailto:support@arenax.io" className="font-medium" style={{ color: "#ff4655" }}>
                support@arenax.io
              </a>
              .
            </p>
          </Section>

          <Section title="8. Fair play">
            <p>You must not misuse the rewards program. Examples of misuse include:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>creating or using more than one account to collect coins or rewards;</li>
              <li>using bots, scripts or other automation to earn coins;</li>
              <li>faking activity, joining and leaving teams to collect rewards, or abusing referrals;</li>
              <li>exploiting a bug instead of reporting it; and</li>
              <li>trying to sell, buy or transfer coins, rewards or accounts.</li>
            </ul>
            <p>
              If we find or reasonably suspect misuse, we may withhold or cancel coins, reject or
              reverse redemptions, and suspend or ban the account.
            </p>
          </Section>

          <Section title="9. Banned or closed accounts">
            <p>
              If your account is banned, any coins you hold, including pending coins, are removed and
              any redemption that has not yet been delivered is cancelled. Rewards that were already
              delivered stay with you unless they were obtained through misuse. Unbanning an account
              does not bring removed coins back. If you close your account yourself, your coins are
              lost.
            </p>
          </Section>

          <Section title="10. Changes to the program">
            <p>
              We may change how coins are earned, what they are worth, the rewards on offer and these
              terms at any time. We may also end the rewards program. Changes apply from the date we
              make them, and we will give reasonable notice of any change that materially reduces the
              value of coins you already hold.
            </p>
            <p>
              Coins do not currently expire. We may introduce an expiry period in future. If we do,
              we will tell you at least 30 days before any coins expire.
            </p>
          </Section>

          <Section title="11. Taxes">
            <p>
              You are responsible for any taxes that may apply to rewards you receive.
            </p>
          </Section>

          <Section title="12. Liability">
            <p>
              Rewards are provided on an &quot;as available&quot; basis. To the maximum extent
              permitted by law, ArenaX is not liable for indirect or consequential loss arising from
              the rewards program, including a reward that is delayed, unavailable or changed. Nothing
              here limits any right you have that cannot be limited by law. These terms are governed
              by the laws of India, and the courts located in India have exclusive jurisdiction.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about Arena Coins or a reward? Write to{" "}
              <a href="mailto:support@arenax.io" className="font-medium" style={{ color: "#ff4655" }}>
                support@arenax.io
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="flex justify-center gap-6 mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
          <Link to="/rewards" className="hover:underline" style={{ color: "#ff4655" }}>
            Back to Rewards
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:underline">
            Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
