import express from "express";
import { asyncHandler, created } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY is required for contact submissions" });
    }

    const { fullName, email, company, contactNumber, inquiryType, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ message: "Full name, email, and message are required" });
    }

    const { data: inquiry, error } = await supabaseAdmin
      .from("contact_inquiries")
      .insert({
        full_name: fullName,
        email,
        company,
        contact_number: contactNumber,
        inquiry_type: inquiryType || "general",
        message,
      })
      .select("id, full_name, email, company, contact_number, inquiry_type, message, status, created_at, updated_at")
      .single();

    if (error || !inquiry) {
      return res.status(400).json({ message: error?.message || "Unable to submit inquiry" });
    }

    return created(res, {
      inquiry: {
        _id: inquiry.id,
        fullName: inquiry.full_name,
        email: inquiry.email,
        company: inquiry.company,
        contactNumber: inquiry.contact_number,
        inquiryType: inquiry.inquiry_type,
        message: inquiry.message,
        status: inquiry.status,
        createdAt: inquiry.created_at,
        updatedAt: inquiry.updated_at,
      },
    });
  }),
);

export default router;
