'use strict'

/**
 * Case Study: industries/regions many-to-many → many-to-one.
 *
 * A case study may now have only ONE industry and ONE region.
 * Migrates existing M2M link data into the single-relation link tables
 * Strapi creates for the new manyToOne relations, then drops the old
 * M2M join tables. Idempotent — safe to run on every boot.
 */

const INDUSTRY_OLD = 'industries_related_cases_lnk'
const INDUSTRY_NEW = 'case_studies_industries_lnk'
const REGION_OLD = 'regions_case_studies_lnk'
const REGION_NEW = 'case_studies_regions_lnk'

/** Move one-row-per-case data from an old M2M join table into a new single-relation link table. */
async function migrateSingle(knex, oldTable, newTable, sourceId, targetId) {
  if (!(await knex.schema.hasTable(oldTable))) return

  if (!(await knex.schema.hasTable(newTable))) {
    await knex.schema.createTable(newTable, (t) => {
      t.increments('id').primary()
      t.integer('case_study_id')
      t.integer(targetId)
      t.float('case_study_ord')
    })
  }

  const [{ cnt: newCnt }] = await knex(newTable).count({ cnt: '*' })
  const [{ cnt: oldCnt }] = await knex(oldTable).count({ cnt: '*' })

  // Copy only when the new table is empty and there is source data.
  if (Number(newCnt ?? 0) === 0 && Number(oldCnt ?? 0) > 0) {
    // One row per case study — keep the earliest link (MIN id = insertion order).
    await knex.raw(
      `INSERT INTO ${newTable} (case_study_id, ${targetId}, case_study_ord)
       SELECT case_study_id, ${targetId}, case_study_ord
       FROM ${oldTable}
       WHERE id IN (SELECT MIN(id) FROM ${oldTable} GROUP BY case_study_id)`
    )
  }

  // Drop the old table only once its data has been carried over.
  const [{ cnt: afterCnt }] = await knex(newTable).count({ cnt: '*' })
  if (Number(afterCnt ?? 0) > 0) {
    await knex.schema.dropTableIfExists(oldTable)
  }
}

async function up(knex) {
  await migrateSingle(knex, INDUSTRY_OLD, INDUSTRY_NEW, 'case_study_id', 'industry_id')
  await migrateSingle(knex, REGION_OLD, REGION_NEW, 'case_study_id', 'region_id')
}

/** Reverse: recreate the M2M join tables from the single-relation link tables. */
async function restoreMany(knex, newTable, oldTable, targetId) {
  if (!(await knex.schema.hasTable(newTable))) return

  if (!(await knex.schema.hasTable(oldTable))) {
    await knex.schema.createTable(oldTable, (t) => {
      t.increments('id').primary()
      t.integer(targetId)
      t.integer('case_study_id')
      t.float('case_study_ord')
      t.float(`${targetId.slice(0, -3)}_ord`)
    })
  }

  const [{ cnt }] = await knex(oldTable).count({ cnt: '*' })
  if (Number(cnt) === 0) {
    await knex.raw(
      `INSERT INTO ${oldTable} (${targetId}, case_study_id, case_study_ord, ${targetId.slice(0, -3)}_ord)
       SELECT ${targetId}, case_study_id, case_study_ord, case_study_ord FROM ${newTable}`
    )
  }

  await knex.schema.dropTableIfExists(newTable)
}

async function down(knex) {
  await restoreMany(knex, INDUSTRY_NEW, INDUSTRY_OLD, 'industry_id')
  await restoreMany(knex, REGION_NEW, REGION_OLD, 'region_id')
}

module.exports = { up, down }
