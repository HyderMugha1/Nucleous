import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import organizationRoutes from "./routes/organizations.js";
import userRoutes from "./routes/users.js";
import sourceRoutes from "./routes/sources.js";
import entityRoutes from "./routes/entities.js";
import mentionRoutes from "./routes/mentions.js";
import narrativeRoutes from "./routes/narratives.js";
import alertRuleRoutes from "./routes/alertRules.js";
import alertRoutes from "./routes/alerts.js";
import campaignRoutes from "./routes/campaigns.js";
import crisisRoutes from "./routes/crisis.js";
import reportRoutes from "./routes/reports.js";
import influencerRoutes from "./routes/influencers.js";
import influencerPostRoutes from "./routes/influencerPosts.js";
import tvRoutes from "./routes/tv.js";
import newsRoutes from "./routes/news.js";
import mediaIntelligenceRoutes from "./routes/mediaIntelligence.js";
import conversationRoutes from "./routes/conversations.js";
import adminRoutes from "./routes/admin.js";
import bootstrapRoutes from "./routes/bootstrap.js";
import chatbotRoutes from "./routes/chatbots.js";
import contactRoutes from "./routes/contact.js";
import diagnosticRoutes from "./routes/diagnostic.js";
import tiktokRoutes from "./routes/tiktok.js";

function buildAllowedOrigins() {
  const configured = [config.clientUrl].filter(Boolean);
  if (!config.isProduction) {
    configured.push("http://localhost:8080", "http://127.0.0.1:8080");
  }
  const expanded = new Set(configured);

  for (const origin of configured) {
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost") {
        expanded.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
      }
      if (url.hostname === "127.0.0.1") {
        expanded.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);
      }
    } catch {
      // ignore malformed configured origins
    }
  }

  return expanded;
}

const allowedOrigins = buildAllowedOrigins();
const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const vercelAppPattern = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i;

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        const allowLocalhost = !config.isProduction && localhostPattern.test(origin || "");
        if (!origin || allowedOrigins.has(origin) || allowLocalhost || vercelAppPattern.test(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/diagnostic", diagnosticRoutes);
  app.use("/api/tiktok", tiktokRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/organizations", requireAuth, organizationRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api/sources", requireAuth, sourceRoutes);
  app.use("/api/entities", requireAuth, entityRoutes);
  app.use("/api/mentions", requireAuth, mentionRoutes);
  app.use("/api/narratives", requireAuth, narrativeRoutes);
  app.use("/api/alert-rules", requireAuth, alertRuleRoutes);
  app.use("/api/alerts", requireAuth, alertRoutes);
  app.use("/api/campaigns", requireAuth, campaignRoutes);
  app.use("/api/crisis", requireAuth, crisisRoutes);
  app.use("/api/reports", requireAuth, reportRoutes);
  app.use("/api/influencers", requireAuth, influencerRoutes);
  app.use("/api/influencer-posts", requireAuth, influencerPostRoutes);
  app.use("/api/tv", requireAuth, tvRoutes);
  app.use("/api/news", requireAuth, newsRoutes);
  app.use("/api/media-intelligence", requireAuth, mediaIntelligenceRoutes);
  app.use("/api/conversations", requireAuth, conversationRoutes);
  app.use("/api/chatbots", requireAuth, chatbotRoutes);
  app.use("/api/admin", requireAuth, adminRoutes);
  app.use("/api/bootstrap", requireAuth, bootstrapRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Unexpected server error",
    });
  });

  return app;
}

export const app = createApp();
