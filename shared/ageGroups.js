/**
 * Age groups of the stories, youngest first. Shared by the client and the server
 * (the ENUM columns of scripts/init-db.sql and server/config/database.js must list the same values: checked by a test).
 */
export const AGE_GROUPS = Object.freeze(['2-3', '4-6', '7-9', '10-12', '13-15', '16-18']);
