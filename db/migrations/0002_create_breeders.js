exports.up = function(knex) {
  return knex.schema.createTable('breeders', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('country_code', 2).references('code').inTable('countries').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('breeders');
};