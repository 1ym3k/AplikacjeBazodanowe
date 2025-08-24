
exports.up = function(knex) {
  return knex.schema.createTable('countries', function(table) {
    table.string('code', 2).primary(); // dwuliterowy kod ISO
    table.string('name').notNullable(); // pełna nazwa kraju
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('countries');
};