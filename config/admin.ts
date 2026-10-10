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
          const previewStatus = status === "published" ? "published" : "draft";
          const buildUrl = (path: string) => {
            const query = new URLSearchParams({
              secret: previewSecret,
              url: path,
              status: previewStatus,
            });
            return `${previewBaseUrl}/api/preview?${query.toString()}`;
          };

          /**
           * Public path of a content-type entry: `parent-chain + slug`, or a
           * root-level `/<slug>` when no parent page is set — the same rule the
           * frontend's route tree applies. `parent` is always a page and pages
           * have no parent of their own, so one level is enough.
           */
          const detailPath = async () => {
            if (!documentId) return null;

            const opts = {
              documentId,
              status: previewStatus,
              populate: { parent: true },
            } as const;

            const doc =
              uid === "api::case-study.case-study"
                ? await strapi
                    .documents("api::case-study.case-study")
                    .findOne(opts)
                : uid === "api::insight.insight"
                ? await strapi.documents("api::insight.insight").findOne(opts)
                : uid === "api::service.service"
                ? await strapi.documents("api::service.service").findOne(opts)
                : null;

            const slug = doc?.slug;
            if (!slug) return null;

            const parentSlug = doc?.parent?.slug;
            return parentSlug && parentSlug !== "index"
              ? `/${parentSlug}/${slug}`
              : `/${slug}`;
          };

          if (uid !== "api::page.page") {
            return buildUrl((await detailPath()) ?? "/");
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
