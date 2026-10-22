# 公開サイトの復元方法

2026年10月22日の写真追加前の公開用ソースは、GitHub の `backup/public-2026-10-22` ブランチに保存しています。

- リポジトリ: `wa82ru/websitetest`
- 保存したコミット: `a9f19db675a16cb398e6a58985449eae9a460f3a`
- 公開ページ: `https://wa82ru.github.io/websitetest/files/`

GitHub Pages が `main` ブランチから公開されている場合、以前のファイル内容へ戻すには、リポジトリを取得して次を実行します。

```sh
git switch main
git pull --ff-only origin main
git restore --source origin/backup/public-2026-10-22 --staged --worktree .
git commit -m "Restore public site to 2026-10-22 baseline"
git push origin main
```

この手順は履歴を消さず、復元用の新しいコミットを作ります。反映後に公開ページを再読み込みして確認してください。バックアップブランチを削除した場合も、上記コミットIDを `--source` に指定できます。
