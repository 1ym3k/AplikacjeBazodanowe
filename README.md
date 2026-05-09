# Horse Stud Management System (API)

**An academic project focused on database applications.** This is a fully functional RESTful API built with Node.js using the Express framework and a PostgreSQL database. The application demonstrates proficiency in relational database modeling, complex query handling using a query builder (Knex.js), and the implementation of sophisticated business logic.

---

## Key Features

* **Full CRUD Operations:** Manage entities including Horses (`horses`), Breeders (`breeders`), and Countries (`countries`).
* **Complex Business Logic (Genetics):**
    * **Automatic Breed Calculation:** The system automatically determines the breed of offspring based on parental breeds (e.g., crossing `oo` and `xx` results in `xxoo`).
    * **Breed Propagation:** Breed changes are propagated down the genealogical tree; updating an ancestor's breed automatically triggers updates for all descendants .
* **Relational Data Validation:**
    * **Parental Integrity:** Validates that the mother is a mare (`mare`) and the father is a stallion (`stallion`).
    * **Age Validation:** Ensures parents are at least 2 years older than their offspring.
    * **Gender Lock:** Prevents changing the gender of a horse with offspring to anything other than a gelding (`gelding`).
* **Pedigree Generation:** Recursively retrieves a horse's genealogy to a specified depth, available in both JSON format and a visually rendered HTML view.
* **Migrations and Seeding:** The database structure is managed via Knex migrations. Seed scripts generate realistic, multi-generational test data using Faker.js.

---

## Technologies

* **Backend:** Node.js, Express.js 
* **Database:** PostgreSQL 
* **Query Builder:** Knex.js 
* **Environment Management:** dotenv 
* **Data Mocking:** Faker.js (@faker-js/faker)

---

## Database Architecture

1.  **`countries`**: A dictionary of countries using ISO 2-letter codes and full names.
2.  **`breeders`**: A registry of breeders linked to specific countries via foreign keys.
3.  **`horses`**: The primary table storing horse profiles (name, breed, birth date, color, gender) and hierarchical foreign keys (`mother_id`, `father_id`) to define lineage.

---

## Getting Started

### Prerequisites
* Node.js (v14+)
* PostgreSQL (local or remote instance)

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment. Create a `.env` file in the root directory based on the provided configuration:
    ```env
    NODE_ENV=development
    PG_HOST=localhost
    PG_USER=postgres
    PG_PASSWORD=your_password
    PG_DATABASE=konie
    PG_PORT=5432
    PORT=3000
    ```
4.  Create a PostgreSQL database (e.g., named `konie`).
5.  Run migrations to set up the schema:
    ```bash
    npm run migrate
    ```
6.  (Optional) Seed the database with sample data:
    ```bash
    npm run seed
    ```
7.  Start the server:
    ```bash
    npm start
    ```

The API will be available at `http://localhost:3000`.

---

## API Endpoints

* **GET `/horses`**: Retrieve all horses (supports filtering by `gender`).
* **GET `/horses/:id/pedigree?depth=3`**: Get a horse's pedigree in JSON format up to 3 generation.
* **GET `/horses/:id/pedigree/html`**: View a visual HTML representation of the pedigree.
* **POST `/horses`**: Add a new horse with automatic breed validation and lineage checking.
* **GET `/breeders`**: List all breeders.
* **GET `/countries`**: List all available countries.

*(A complete list of cURL commands is available in the `curl.txt` file in the repository).*

---
*Project developed as part of a Database Applications course.*
