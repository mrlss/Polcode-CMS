import type { Core } from "@strapi/strapi";

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Content Manager Organizer — pre-seed a default sidebar grouping so the
    // admin is organized on first launch. Fully editable later in
    // Settings → Content Manager Organizer (drag & drop, persisted to DB).
    try {
      const organizerQuery = strapi.db.query(
        "plugin::content-manager-organizer.content-manager-configuration",
      );
      const existingOrg = await organizerQuery.findOne({
        where: { key: "main" },
      });
      if (!existingOrg) {
        await organizerQuery.create({
          data: {
            key: "main",
            config: {
              stripNumericPrefix: true,
              sortBy: "alphabetical",
              groups: [
                {
                  id: "content",
                  label: "Content",
                  defaultExpanded: true,
                  kind: "collectionType",
                  items: ["case-study", "insight", "faq"],
                },
                {
                  id: "company",
                  label: "Company",
                  defaultExpanded: true,
                  kind: "collectionType",
                  items: [
                    "team",
                    "client",
                    "achievement",
                    "client-testimonial",
                    "team-testimonial",
                    "hiring-process",
                    "process",
                  ],
                },
                {
                  id: "taxonomies",
                  label: "Taxonomies",
                  defaultExpanded: false,
                  kind: "collectionType",
                  items: [
                    "industry",
                    "service",
                    "region",
                    "platform",
                    "tech-stack",
                    "author",
                    "tag",
                    "primary-audience",
                    "resource-type",
                  ],
                },
                {
                  id: "site",
                  label: "Site",
                  defaultExpanded: false,
                  kind: "collectionType",
                  items: ["page"],
                },
              ],
            },
          },
        });
        console.log("[organizer] seeded default sidebar groups");
      }
    } catch (error: any) {
      console.warn(
        "Could not seed content-manager-organizer config:",
        error?.message,
      );
    }

    try {
      const MAIN_FIELD_OVERRIDES: Record<string, string> = {
        "api::author.author": "fullName",
        "api::team.team": "firstName",
        "api::client.client": "name",
      };
      const contentTypesService = strapi
        .plugin("content-manager")
        .service("content-types");

      for (const schema of Object.values(strapi.contentTypes)) {
        if (!schema.uid.startsWith("api::")) continue;
        const attributes = schema.attributes as Record<string, unknown>;
        const mainField =
          MAIN_FIELD_OVERRIDES[schema.uid] ??
          ("title" in attributes ? "title" : null);
        if (!mainField || !(mainField in attributes)) continue;

        const configuration =
          await contentTypesService.findConfiguration(schema);
        if (!configuration || configuration.settings?.mainField === mainField) {
          continue;
        }
        await contentTypesService.updateConfiguration(schema, {
          ...configuration,
          settings: { ...configuration.settings, mainField },
        });
      }
    } catch (error: any) {
      console.warn("Could not set content-manager mainField:", error?.message);
    }

    // Editorial copy + edit-view layout for the Content Manager. Strapi stores
    // these in the content-manager configuration, so a schema `description`
    // alone would only show up in the Content-Type Builder.
    try {
      const { setAdminViewCopy } = await import("./admin-view");
      await setAdminViewCopy(strapi);
    } catch (error: any) {
      console.warn("Could not apply admin view copy:", error?.message);
    }

    // Idempotent local demo data — opt-in via SEED_DEMO=true
    if (process.env.SEED_DEMO === "true") {
      try {
        const { seedContent, seedGlobals } = await import("./seed-content");
        await seedContent(strapi);
        await seedGlobals(strapi);
      } catch (error: any) {
        console.warn("Could not seed demo data:", error?.message);
        if (error?.details?.errors) {
          error.details.errors.forEach((e: any) =>
            console.warn("[seed] detail:", JSON.stringify(e)),
          );
        }
      }

      // Idempotent navigations + page scaffold (runs after content so the
      // demo homepage already exists and nav links resolve).
      try {
        const { seedNavigation } = await import("./seed-navigation");
        await seedNavigation(strapi);
      } catch (error: any) {
        console.warn("Could not seed navigations:", error?.message);
        if (error?.details?.errors) {
          error.details.errors.forEach((e: any) =>
            console.warn("[seed-navigation] detail:", JSON.stringify(e)),
          );
        }
      }
    }
  },
};
