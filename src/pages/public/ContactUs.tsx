import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactInquiry } from "@/lib/api";
import { siteConfig } from "@/lib/site";
import { toast } from "@/hooks/use-toast";

export default function ContactUs() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    contactNumber: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async (inquiryType: "general" | "demo") => {
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: "Missing required details",
        description: "Please provide your name, email, and message.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await submitContactInquiry({
        ...formData,
        inquiryType,
      });
      toast({
        title: inquiryType === "demo" ? "Demo request sent" : "Inquiry sent",
        description: "Your message has been saved and is ready for follow-up.",
      });
      setFormData({
        fullName: "",
        email: "",
        company: "",
        contactNumber: "",
        message: "",
      });
    } catch (error) {
      toast({
        title: "Unable to send inquiry",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="rounded-[2rem] border border-primary/15 gradient-hero px-6 py-10 md:px-10">
        <img src="/logo-mark.svg" alt="Nucleus" className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)]" />
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Contact Us</p>
        <h1 className="mt-4 text-4xl font-bold premium-heading md:text-5xl">
          Talk to us about onboarding, security, demos, and team setup.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-soft">
          Whether you want a guided product walkthrough or you are preparing to roll Nucleus out to leadership, marketing,
          or crisis teams, we can help you get the workspace configured properly.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm("general");
          }}
          className="glass-premium space-y-4 rounded-[1.75rem] p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">Contact Form</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input value={formData.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Full Name" className="h-11 rounded-xl border-border/50 bg-muted/40" />
            <Input value={formData.email} onChange={(event) => updateField("email", event.target.value)} placeholder="Work Email" className="h-11 rounded-xl border-border/50 bg-muted/40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input value={formData.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Company" className="h-11 rounded-xl border-border/50 bg-muted/40" />
            <Input value={formData.contactNumber} onChange={(event) => updateField("contactNumber", event.target.value)} placeholder="Contact Number" className="h-11 rounded-xl border-border/50 bg-muted/40" />
          </div>
          <Textarea
            value={formData.message}
            onChange={(event) => updateField("message", event.target.value)}
            placeholder="Tell us what you want to explore: onboarding, security review, use cases, or a live demo."
            className="min-h-32 rounded-xl border-border/50 bg-muted/40"
          />
          <Button type="submit" disabled={submitting} className="h-11 rounded-xl gradient-primary text-primary-foreground">
            Send Inquiry
          </Button>
        </form>

        <div className="space-y-4">
          <div className="chart-shell space-y-4 p-6">
            <h2 className="text-lg font-semibold text-foreground">Support Details</h2>
            <p className="text-sm text-soft">Website: {siteConfig.siteUrl}</p>
            <p className="text-sm text-soft">Support channel: public contact form at {siteConfig.contactUrl}</p>
            <p className="text-sm text-soft">Availability: Enterprise onboarding, implementation support, compliance review, and guided demos.</p>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void submitForm("demo")}
              variant="outline"
              className="h-11 rounded-xl border-primary/35 text-primary hover:bg-primary/10"
            >
              Book a Demo
            </Button>
          </div>

          <div className="glass-premium rounded-[1.75rem] p-6">
            <h2 className="text-lg font-semibold text-foreground">What happens next</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-soft">
              <p>We help align your use case, onboarding fields, and workspace access model.</p>
              <p>Your team can review the platform publicly first, then move into protected dashboards after login.</p>
              <p>Signup details like company, contact number, and competitors can be used to tailor the post-login experience.</p>
              <p>Public legal pages remain accessible without login at {siteConfig.privacyUrl} and {siteConfig.termsUrl}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
