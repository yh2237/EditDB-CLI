## 開発環境のセットアップ

1.  **リポジトリをクローンします:**
    ```bash
    git clone https://github.com/yh2237/EditDB-CLI.git
    cd EditDB-CLI
    ```

2.  **依存パッケージをインストールします:**
    ```bash
    npm install
    ```

3.  **ローカル開発用にパッケージをリンクします:**
    これにより、ローカルのソースコードを指すグローバルな`editdb`コマンドが作成されます。
    ```bash
    npm link
    ```
    これで、ターミナルのどこからでも`editdb`コマンドを実行して、ローカルでの変更をテストできます。

## スクリプト

-   **テストの実行:**
    ```bash
    npm test
    ```

-   **コードのリンティング:**
    コードの品質とスタイルに関する問題をチェックします。
    ```bash
    npm run lint
    ```

-   **コードのフォーマット:**
    Prettierを使ってコードを自動整形します。
    ```bash
    npm run format
    ```
