import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-ink-500 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>トップに戻る</span>
          </Link>
        </div>

        <article className="card p-8 lg:p-12 animate-fade-in">
          <h1 className="heading-serif text-3xl mb-2">プライバシーポリシー</h1>
          <p className="text-ink-400 text-sm mb-8">最終更新日: 2025年1月31日</p>

          <div className="prose prose-ink max-w-none space-y-8">
            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">1. はじめに</h2>
              <p className="text-ink-600 leading-relaxed">
                InkTopik（以下「本サービス」）は、ユーザーのプライバシーを尊重し、
                個人情報の保護に努めています。本ポリシーでは、収集する情報の種類、
                利用目的、保護方法について説明します。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">2. 収集する情報</h2>
              <p className="text-ink-600 leading-relaxed mb-3">
                本サービスでは、以下の情報を収集することがあります。
              </p>
              <ul className="list-disc list-inside text-ink-600 space-y-2 ml-2">
                <li>
                  <span className="font-medium">アカウント情報:</span>{" "}
                  メールアドレス、表示名、プロフィール画像（Google認証経由で取得）
                </li>
                <li>
                  <span className="font-medium">学習データ:</span>{" "}
                  作成したノート、チャット履歴、学習進捗
                </li>
                <li>
                  <span className="font-medium">利用情報:</span>{" "}
                  アクセスログ、利用頻度、機能の使用状況
                </li>
                <li>
                  <span className="font-medium">技術情報:</span>{" "}
                  IPアドレス、ブラウザ種類、デバイス情報
                </li>
              </ul>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">3. 情報の利用目的</h2>
              <p className="text-ink-600 leading-relaxed mb-3">
                収集した情報は、以下の目的で利用します。
              </p>
              <ul className="list-disc list-inside text-ink-600 space-y-2 ml-2">
                <li>本サービスの提供・運営</li>
                <li>ユーザー認証とセキュリティの確保</li>
                <li>学習データの保存と表示</li>
                <li>サービスの改善と新機能の開発</li>
                <li>お問い合わせへの対応</li>
                <li>利用規約違反への対処</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">4. 情報の共有</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  本サービスは、以下の場合を除き、個人情報を第三者に提供しません。
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>ユーザーの同意がある場合</li>
                  <li>法令に基づく開示請求がある場合</li>
                  <li>サービス提供に必要な業務委託先への提供（適切な管理のもと）</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">5. 外部サービス</h2>
              <p className="text-ink-600 leading-relaxed mb-3">
                本サービスでは以下の外部サービスを利用しています。
              </p>
              <ul className="list-disc list-inside text-ink-600 space-y-2 ml-2">
                <li>
                  <span className="font-medium">Google OAuth:</span>{" "}
                  ログイン認証のため
                </li>
                <li>
                  <span className="font-medium">Cloudflare:</span>{" "}
                  ホスティング、データベース、ファイルストレージのため
                </li>
                <li>
                  <span className="font-medium">OpenRouter:</span>{" "}
                  AI機能（質問応答、画像解析）のため。チャットで入力した内容やアップロードした画像はAI処理のため送信されます
                </li>
              </ul>
              <p className="text-ink-600 leading-relaxed mt-3">
                各サービスのプライバシーポリシーについては、それぞれの公式サイトをご確認ください。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">6. Cookieの使用</h2>
              <p className="text-ink-600 leading-relaxed">
                本サービスでは、セッション管理およびユーザー認証のためにCookieを使用しています。
                Cookieを無効にした場合、サービスの一部機能が利用できなくなる場合があります。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">7. 子どものプライバシー</h2>
              <p className="text-ink-600 leading-relaxed">
                本サービスは、13歳未満の子どもを対象としていません。
                13歳未満の方が個人情報を提供したことが判明した場合、速やかに削除します。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">8. ポリシーの変更</h2>
              <p className="text-ink-600 leading-relaxed">
                本ポリシーは、必要に応じて変更されることがあります。
                重要な変更がある場合は、本サービス上で通知します。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">9. お問い合わせ</h2>
              <p className="text-ink-600 leading-relaxed">
                プライバシーに関するご質問やご要望がある場合は、
                本サービス内のお問い合わせ機能よりご連絡ください。
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
