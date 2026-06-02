export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: June 2, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Overview</h2>
            <p>
              Nucleus is a media intelligence platform that helps organizations monitor, review, and manage digital media
              activity across connected sources such as news, broadcast, video, and approved social accounts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Use of the Service</h2>
            <p>
              You may use the platform only for lawful business purposes. You are responsible for ensuring that any
              connected third-party account, content source, or data source is authorized for your use.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Account Responsibility</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for activity that
              occurs under your account or organization workspace.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Third-Party Platforms</h2>
            <p>
              Our service may integrate with third-party providers such as TikTok, YouTube, and other media sources.
              Your use of those integrations is also subject to the provider&apos;s own terms and policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Content and Data</h2>
            <p>
              You retain responsibility for the content and account connections you provide. We may process public or
              authorized media metadata to deliver dashboards, monitoring, analytics, and operational workflows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Acceptable Conduct</h2>
            <p>
              You may not misuse the service, attempt unauthorized access, interfere with platform operations, or use the
              service in a way that violates applicable law or third-party platform rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Availability</h2>
            <p>
              We may update, modify, suspend, or improve features at any time. We do not guarantee uninterrupted
              availability of any third-party integration.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>
              For questions about these terms, contact the platform administrator or support team listed for your
              deployment.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
