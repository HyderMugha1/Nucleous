import { siteConfig } from "@/lib/site";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: June 12, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              We collect account registration details, organization profile details, connected account identifiers, and
              media-related data that is uploaded, queried, or synchronized through approved platform integrations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Information</h2>
            <p>
              We use information to operate the Nucleus platform, authenticate users, manage organization workspaces,
              deliver monitoring dashboards, provide analytics and reporting, and support approved customer workflows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Third-Party Integrations</h2>
            <p>
              If you connect third-party services such as TikTok or YouTube, we may process authorized account profile data,
              access tokens, and public or permitted media metadata strictly for the features you enable inside the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Data Sharing</h2>
            <p>
              We do not sell personal information. We share data only with service providers and infrastructure partners
              that help us host, secure, and operate the service, or when required by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Security and Storage</h2>
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect stored data and integration
              credentials. No internet service can guarantee absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Retention</h2>
            <p>
              We retain information for as long as necessary to operate customer workspaces, maintain audit history, resolve
              support issues, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Your Rights and Choices</h2>
            <p>
              Organization administrators may update workspace information, disconnect integrations, or request deletion
              assistance subject to applicable legal, contractual, and operational requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Contact and Requests</h2>
            <p>
              For privacy questions, data access requests, or deletion requests related to your use of {siteConfig.name},
              contact us through <a href={siteConfig.contactUrl} className="text-primary underline underline-offset-4">{siteConfig.contactUrl}</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
