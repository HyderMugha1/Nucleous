export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: June 2, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              We collect account information, workspace details, and media-related data that is uploaded, connected, or
              synchronized through approved integrations and platform workflows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Information</h2>
            <p>
              We use information to provide media monitoring, video and content management, analytics, search, reporting,
              and operational dashboard features for authorized organization users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Third-Party Integrations</h2>
            <p>
              If you connect third-party services such as TikTok or YouTube, we may process authorized account data and
              public media metadata to display connected content inside the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Sharing</h2>
            <p>
              We do not sell personal information. Data is shared only as needed to operate the service, support approved
              integrations, comply with law, or provide infrastructure and hosting.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Security</h2>
            <p>
              We use reasonable administrative and technical measures to protect stored data, but no system can guarantee
              absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Retention</h2>
            <p>
              We retain information for as long as needed to operate the service, maintain workspace history, resolve
              disputes, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Your Choices</h2>
            <p>
              Organization administrators may remove connected accounts, update workspace information, or request data
              removal subject to applicable legal and operational requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>
              For privacy questions or requests, contact the platform administrator or support contact associated with your
              deployment.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
