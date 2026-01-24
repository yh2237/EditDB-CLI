## Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yh2237/EditDB-CLI.git
    cd EditDB-CLI
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Link the package for local development:**
    This will create a global `editdb` command that points to your local source code.
    ```bash
    npm link
    ```
    Now you can run `editdb` anywhere in your terminal to test your local changes.

## Scripts

-   **Run tests:**
    ```bash
    npm test
    ```

-   **Lint the code:**
    Check for code quality and style issues.
    ```bash
    npm run lint
    ```

-   **Format the code:**
    Automatically format the code using Prettier.
    ```bash
    npm run format
    ```
