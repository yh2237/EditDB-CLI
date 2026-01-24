# Features

`editdb-cli` is a powerful CLI tool that provides a comprehensive interactive interface for managing SQLite databases.

### Database Management
- **Interactive Database Selection**: Automatically detects `.db` and `.sqlite` files in the current directory and allows you to choose one.
- **Create New Database**: You can create a new database file directly from the tool.

### Table Management
- **Interactive Table Selection**: Displays a list of existing tables to choose from.
- **Create New Table**: An interactive prompt guides you through defining columns, data types, primary keys, and constraints to create a new table.
- **Alter Table**:
    - Add new columns.
    - Drop existing columns (with a compatibility-safe method).
    - Rename tables.
- **View Schema**: Display the schema of a selected table at any time.

### Row/Data Management
- **Paginated Data Browser**: View table data in a paginated list, making it easy to navigate through large datasets.
- **Single Row Operations**:
    - Select a row to view its details.
    - Update specific columns of a selected row.
    - Delete a selected row.
- **Multiple Row Operations**:
    - **Safe WHERE Clause Builder**: Interactively build `WHERE` clauses by selecting columns, operators, and values, preventing SQL injection.
    - Update all rows matching the built `WHERE` clause.
    - Delete all rows matching the built `WHERE` clause.
- **Insert New Row**: An interactive prompt helps you insert a new row by asking for a value for each column.

### Querying
- **Custom `SELECT` Query**: Execute custom, read-only `SELECT` queries to perform complex data retrieval.

### Other
- **Internationalization (i18n)**: Supports multiple languages (English and Japanese), automatically detecting your system's language preference.
- **Helpful Logging**: Provides clear, color-coded feedback for successes, warnings, and errors.
