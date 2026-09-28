/* =====================================================================
   Burnout Pulse: deployment configuration
   ---------------------------------------------------------------------
   Edit this file per institution. It is the ONLY file a pilot site
   should need to change. Nothing here is secret; do not put keys here.
   ===================================================================== */
(function (root) {
  "use strict";
  root.BP_CONFIG = {
    // Shown in the footer and on the sign-in screen. Leave empty for a
    // generic build. Do not use an institution's name or marks without
    // its written permission.
    institutionName: "",

    // Institution-specific support shown beside the national resources.
    // Each entry: { label, detail, phone?, url? }. Example:
    //   { label: "Department of Surgery peer support",
    //     detail: "Confidential peer support after adverse events.",
    //     phone: "410-555-0100" }
    resources: [],

    // Lock the local vault after this many idle minutes. Hospital
    // workstations are shared, so keep this short.
    idleLockMinutes: 15,

    // The live AI coach calls this same-origin endpoint. Set to "" to
    // disable the live coach entirely for a deployment (offline prompts
    // only, nothing is ever sent off the device).
    coachEndpoint: "/api/coach",

    // Shown on the coach consent screen. The deployer is responsible for
    // making this accurate for its own agreements with the AI provider.
    aiProcessorName: "Anthropic",

    // Local retention caps (per account, on this device).
    maxCheckins: 104,       // two years of weekly check-ins
    maxCoachMessages: 300
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
