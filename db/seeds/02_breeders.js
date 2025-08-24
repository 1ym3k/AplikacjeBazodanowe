const { faker } = require('@faker-js/faker');

exports.seed = async function (knex) {
  await knex('breeders').del();
  const countries = await knex('countries').select('code');
  const breeders = Array(10).fill().map(() => ({
    name: faker.company.name() + ' Stables',
    country_code: faker.helpers.arrayElement(countries).code
  }));
  await knex('breeders').insert(breeders);
};