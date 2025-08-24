exports.up = function(knex) {
  return knex.schema.createTable('horses', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.enum('breed', ['oo', 'xx', 'xo', 'xxoo']).notNullable();
    table.integer('birth_year');
    table.date('birth_date');
    table.enum('gender', ['mare', 'stallion', 'gelding']).notNullable();
    table.integer('mother_id').references('id').inTable('horses').onDelete('SET NULL');
    table.integer('father_id').references('id').inTable('horses').onDelete('SET NULL');
    table.integer('breeder_id').references('id').inTable('breeders').onDelete('SET NULL');
    table.string('color').notNullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('horses');
};