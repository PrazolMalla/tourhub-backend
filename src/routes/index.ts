import { Router } from "express";
import authRoutes from "../modules/auth/auth.module";
import googleOAuthRoutes, { adminGoogleOAuthRoutes } from "../modules/auth/oauth/google.module";
import userRoutes from "../modules/user/user.module";
import regionRoutes from "../modules/region/region.module";
import tripRoutes from "../modules/trip/trip.module";
import blogRoutes from "../modules/blog/blog.module";
import testimonialRoutes from "../modules/testimonial/testimonial.module";
import partnerRoutes from "../modules/partner/partner.module";
import holidayRoutes from "../modules/holiday/holiday.module";
import vehicleRoutes from "../modules/vehicle/vehicle.module";
import enquiryRoutes from "../modules/enquiry/enquiry.module";
import schoolTripChecklistRoutes from "../modules/school-trip-checklist/school-trip-checklist.module";
import adminManagementRoutes from "../modules/admin-management/admin-management.module";
import siteContentRoutes from "../modules/site-content/site-content.module";
import bannerRoutes from "../modules/banner/banner.module";
import dashboardRoutes from "../modules/dashboard/dashboard.module";
import teamMemberModule from "@modules/team-member/team-member.module";
import seoRoutes from "../modules/seo/seo.module";

export class IndexRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use("/auth", authRoutes);
    if (googleOAuthRoutes) {
      this.router.use("/auth/google", googleOAuthRoutes);
    }
    if (adminGoogleOAuthRoutes) {
      this.router.use("/auth/admin/google", adminGoogleOAuthRoutes);
    }
    this.router.use("/users", userRoutes);
    // ── Trekking content domain ──────────────────────────────────
    this.router.use("/regions", regionRoutes);
    this.router.use("/trips", tripRoutes);
    this.router.use("/blog", blogRoutes);
    this.router.use("/testimonials", testimonialRoutes);
    this.router.use("/partners", partnerRoutes);
    this.router.use("/vehicles", vehicleRoutes);
    this.router.use("/holidays", holidayRoutes);
    this.router.use("/enquiries", enquiryRoutes);
    this.router.use("/school-trip-checklists", schoolTripChecklistRoutes);
    // ── Site-wide content & ops ──────────────────────────────────
    this.router.use("/site-content", siteContentRoutes);
    this.router.use("/banners", bannerRoutes);
    this.router.use("/admins", adminManagementRoutes);
    this.router.use("/dashboard", dashboardRoutes);
    this.router.use("/team-members", teamMemberModule);
    this.router.use("/seo", seoRoutes);
  }
}

export default new IndexRoutes().router;
