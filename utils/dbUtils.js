const db = require('../db/connection');


/**
 * sprwadza czy rekord o podanym id istnieje w tabeli
 * @param {string} tableName - nazwa tabeli
 * @param {number|string} id - id rekordu
 * @returns {Promise<boolean>} - true jesli istnieje
 */
async function recordExists(tableName, id) {
  const record = await db(tableName).where({ id }).first();
  return !!record;
}

/**
 * sprawdza czy rekord o podanym kodzie istnieje w tabeli
 * @param {string} tableName - nazwa tabeli
 * @param {string} code - kod rekordu
 * @returns {Promise<boolean>} - true jesli istnieje
 */
async function recordExistsByCode(tableName, code) {
  const record = await db(tableName).where({ code }).first();
  return !!record;
}

/**
 * czy rekord jest używany jako klucz obcy w innej tabeli
 * @param {string} tableName - nazwa tabeli
 * @param {string} foreignKey - nazwa kolumny
 * @param {number|string} id - id rekordu
 * @returns {Promise<boolean>} - true jesli jest uzywany
 */
async function checkIfUsed(tableName, foreignKey, id) {
  const used = await db(tableName).where({ [foreignKey]: id }).first();
  return !!used;
}

/**
 * jesli rekord istnieje to zwarca po id
 * @param {string} tableName - nazwa tabeli
 * @param {number} id - id rekordu
 * @returns {Promise<object|null>} - zwraca rekord lub null
 */
async function getRecordById(tableName, id) {
  return await db(tableName).where({ id }).first();
}

module.exports = {
  recordExists,
  recordExistsByCode,
  checkIfUsed,
  getRecordById,
};