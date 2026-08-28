import type { Core } from "@strapi/strapi";

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Admin => {
  const previewBaseUrl = env("PREVIEW_BASE_URL", "http://localhost:3000");
  const previewSecret = env("PREVIEW_SECRET", "");

  return {
    auth: {
      secret: env("ADMIN_JWT_SECRET")!,
    },
    apiToken: {
      salt: env("API_TOKEN_SALT")!,
    },
    transfer: {
      token: {
        salt: env("TRANSFER_TOKEN_SALT")!,
      },
    },
    secrets: {
      encryptionKey: env("ENCRYPTION_KEY")!,
    },
    flags: {
      nps: env.bool("FLAG_NPS", true),
      promoteEE: env.bool("FLAG_PROMOTE_EE", true),
      docLinks: env.bool("FLAG_DOC_LINKS", true),
    },
    preview: {
      enabled: true,
      config: {
        allowedOrigins: [previewBaseUrl],
        handler: async (uid, { documentId, status }) => {
          // Only the `page` content type renders as a standalone route on the
          // frontend (catch-all /[[...slug]]). Everything else is embedded in
          // a page, so preview falls back to the homepage.
          const previewStatus = status === "published" ? "published" : "draft";
          const buildUrl = (path: string) => {
            const query = new URLSearchParams({
              secret: previewSecret,
              url: path,
              status: previewStatus,
            });
            return `${previewBaseUrl}/api/preview?${query.toString()}`;
          };

          if (uid !== "api::page.page") {
            return buildUrl("/");
          }

          let slug = "index";
          if (documentId) {
            const page = await strapi.documents("api::page.page").findOne({
              documentId,
              status: previewStatus,
            });
            slug = page?.slug || "index";
          }

          return buildUrl(slug === "index" ? "/" : `/${slug}`);
        },
      },
    },
  };
};

export default config;
