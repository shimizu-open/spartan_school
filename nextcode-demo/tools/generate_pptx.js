const pptxgen = require("pptxgenjs");

const OUT = "system-solutions-presentation.pptx";
const FONT = "Yu Gothic";
const W = 13.333;
const H = 7.5;

const C = {
  ink: "0F1720",
  ink2: "182231",
  paper: "F7F9FC",
  white: "FFFFFF",
  muted: "314155",
  mutedLight: "AEB9C8",
  light: "E8EDF5",
  line: "D9E0E8",
  cyan: "18A7C8",
  green: "28B87A",
  amber: "EF9F22",
  rose: "D95D63",
  violet: "7467D8",
  cardDark: "233044",
};

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.company = "株式会社システムソリューションズ";
pptx.subject = "AWSインフラ構築・クラウド移行・モダナイゼーション営業資料";
pptx.title = "株式会社システムソリューションズ 営業プレゼン資料";
pptx.lang = "ja-JP";
pptx.theme = {
  headFontFace: FONT,
  bodyFontFace: FONT,
  lang: "ja-JP",
};
pptx.defineSlideMaster({
  title: "Blank",
  background: { color: C.white },
  objects: [],
  slideNumber: { x: 12.18, y: 7.08, color: "8B98A8" },
});

const S = pptx.ShapeType;

function text(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: FONT,
    fontSize: opts.size ?? 12,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    margin: opts.margin ?? 0.04,
    breakLine: false,
    fit: "shrink",
    valign: opts.valign ?? "top",
    align: opts.align ?? "left",
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 0,
  });
}

function shape(slide, type, x, y, w, h, opts = {}) {
  slide.addShape(type, {
    x,
    y,
    w,
    h,
    fill: { color: opts.fill ?? C.white, transparency: opts.fillTransparency ?? 0 },
    line: {
      color: opts.line ?? opts.fill ?? C.white,
      transparency: opts.lineTransparency ?? 0,
      width: opts.lineWidth ?? 0.75,
    },
    rotate: opts.rotate ?? 0,
  });
}

function background(slide, dark = false, bg = dark ? C.ink : C.paper) {
  slide.background = { color: bg };
  const grid = dark ? "2D394B" : "E7EDF4";
  [1.2, 3.8, 6.4, 9.0, 11.6].forEach((x) => {
    shape(slide, S.rect, x, 0, 0.01, H, {
      fill: grid,
      line: grid,
      fillTransparency: dark ? 72 : 42,
      lineTransparency: 100,
    });
  });
  [1.28, 3.08, 4.88, 6.68].forEach((y) => {
    shape(slide, S.rect, 0, y, W, 0.01, {
      fill: grid,
      line: grid,
      fillTransparency: dark ? 72 : 42,
      lineTransparency: 100,
    });
  });
}

function brand(slide, dark = false, label = "Corporate Presentation") {
  text(slide, "SS", 0.72, 0.55, 0.42, 0.38, {
    size: 12,
    color: C.white,
    bold: true,
    fill: C.cyan,
    align: "center",
    valign: "mid",
  });
  shape(slide, S.roundRect, 0.72, 0.54, 0.42, 0.42, { fill: C.cyan, line: C.cyan });
  text(slide, "SS", 0.72, 0.61, 0.42, 0.22, {
    size: 11,
    color: C.white,
    bold: true,
    align: "center",
    margin: 0,
  });
  text(slide, "株式会社システムソリューションズ", 1.22, 0.6, 3.2, 0.3, {
    size: 11.5,
    color: dark ? C.light : C.ink,
    bold: true,
    margin: 0,
  });
  text(slide, label, 5.3, 0.6, 2.5, 0.28, {
    size: 9.5,
    color: dark ? C.mutedLight : C.muted,
    margin: 0,
  });
}

function kicker(slide, value, x = 0.72, y = 1.55) {
  shape(slide, S.rect, x, y + 0.15, 0.34, 0.02, { fill: C.cyan, line: C.cyan });
  text(slide, value, x + 0.42, y, 5.4, 0.35, {
    size: 10,
    color: C.cyan,
    bold: true,
    margin: 0,
  });
}

function titleBlock(slide, dark, key, title, lead, y = 1.42) {
  kicker(slide, key, 0.72, y);
  text(slide, title, 0.72, y + 0.42, 8.55, 0.95, {
    size: 26,
    color: dark ? C.light : C.ink,
    bold: true,
    margin: 0,
  });
  text(slide, lead, 0.72, y + 1.48, 7.9, 0.72, {
    size: 12.2,
    color: dark ? C.mutedLight : C.muted,
    margin: 0,
  });
}

function card(slide, x, y, w, h, title, body, opts = {}) {
  const dark = opts.dark ?? false;
  const accent = C[opts.accent ?? "cyan"];
  const fill = dark ? C.cardDark : C.white;
  const border = dark ? "4A5566" : C.line;
  shape(slide, S.roundRect, x, y, w, h, { fill, line: border, lineWidth: 0.75 });
  shape(slide, S.rect, x, y, w, 0.06, { fill: accent, line: accent });
  if (opts.label) {
    shape(slide, S.roundRect, x + 0.18, y + 0.18, 0.52, 0.32, { fill: accent, line: accent });
    text(slide, opts.label, x + 0.18, y + 0.225, 0.52, 0.2, {
      size: 9.3,
      color: C.white,
      bold: true,
      align: "center",
      margin: 0,
    });
    text(slide, title, x + 0.78, y + 0.19, w - 0.96, 0.38, {
      size: opts.titleSize ?? 13.2,
      color: dark ? C.light : C.ink,
      bold: true,
      margin: 0,
    });
  } else {
    text(slide, title, x + 0.18, y + 0.18, w - 0.36, 0.48, {
      size: opts.titleSize ?? 13.2,
      color: dark ? C.light : C.ink,
      bold: true,
      margin: 0,
    });
  }
  text(slide, body, x + 0.18, y + (opts.bodyY ?? 0.78), w - 0.36, h - (opts.bodyY ?? 0.78) - 0.12, {
    size: opts.bodySize ?? 10.2,
    color: dark ? C.mutedLight : C.muted,
    margin: 0,
  });
}

function pill(slide, x, y, value, w, dark = true) {
  shape(slide, S.roundRect, x, y, w, 0.34, {
    fill: dark ? "293545" : "EEF3F7",
    line: dark ? "617085" : "CAD3DE",
  });
  text(slide, value, x, y + 0.06, w, 0.18, {
    size: 8.8,
    color: dark ? C.light : C.ink,
    bold: true,
    align: "center",
    margin: 0,
  });
}

function addDeckFooter(slide, num, dark = false) {
  text(slide, `${num} / 12`, 11.86, 7.08, 0.7, 0.2, {
    size: 8,
    color: dark ? C.mutedLight : "8A96A6",
    margin: 0,
    align: "right",
  });
}

function newSlide(dark = false, bg) {
  const slide = pptx.addSlide("Blank");
  background(slide, dark, bg);
  return slide;
}

function build() {
  let slide;

  slide = newSlide(true, C.ink);
  brand(slide, true);
  kicker(slide, "AWS Infrastructure / Cloud Migration / Modernization");
  text(slide, "企業システムを、\nAWSで次の成長\n基盤へ。", 0.72, 1.98, 5.95, 2.25, {
    size: 36,
    color: C.light,
    bold: true,
    margin: 0,
  });
  text(
    slide,
    "インフラ構築・運用、クラウド移行、大規模システムのモダナイゼーションを一気通貫で支援します。既存資産を活かしながら、変化に強いクラウド基盤へ段階的に移行します。",
    0.72,
    4.36,
    6.3,
    0.78,
    { size: 12.2, color: C.mutedLight, margin: 0 }
  );
  pill(slide, 0.72, 5.45, "AWS基盤設計", 1.3);
  pill(slide, 2.05, 5.45, "CloudOps", 1.0);
  pill(slide, 3.1, 5.45, "移行アセスメント", 1.56);
  pill(slide, 4.78, 5.45, "モダナイゼーション", 1.6);
  shape(slide, S.ellipse, 7.35, 1.35, 4.8, 4.8, {
    fill: C.ink2,
    fillTransparency: 88,
    line: "4C5A6D",
    lineTransparency: 18,
  });
  shape(slide, S.ellipse, 7.78, 1.75, 3.95, 3.95, {
    fill: C.ink2,
    fillTransparency: 92,
    line: C.cyan,
    lineTransparency: 45,
  });
  shape(slide, S.cloud, 8.25, 2.5, 3.1, 1.78, {
    fill: "3A5968",
    fillTransparency: 18,
    line: "6A7E8D",
    lineTransparency: 28,
  });
  [
    [7.9, 1.82, C.cyan],
    [11.02, 2.02, C.green],
    [11.35, 4.48, C.amber],
    [7.42, 4.45, C.rose],
    [9.42, 5.2, C.violet],
  ].forEach(([x, y, color]) => {
    shape(slide, S.roundRect, x, y, 0.76, 0.66, {
      fill: "2B3544",
      fillTransparency: 12,
      line: "637184",
      lineTransparency: 18,
    });
    shape(slide, S.donut, x + 0.25, y + 0.17, 0.28, 0.28, {
      fill: color,
      line: color,
    });
  });
  addDeckFooter(slide, 1, true);

  slide = newSlide(false, C.white);
  brand(slide);
  titleBlock(
    slide,
    false,
    "Market Challenge",
    "企業ITは、守りの運用から攻めの基盤へ転換が必要です。",
    "クラウド移行は単なるサーバー移設ではなく、事業の俊敏性と統制を両立する基盤再設計です。"
  );
  [
    ["老朽化した基盤", "OSやミドルウェアの保守切れ、構成のブラックボックス化、属人化した運用手順がリスクになります。", "cyan", "01"],
    ["運用負荷の増大", "監視、バックアップ、障害対応、リリース作業が手作業に依存し、改善に時間を使えません。", "green", "02"],
    ["変化への追従不足", "需要変動や新規施策に対し、環境準備や容量計画がボトルネックになりがちです。", "amber", "03"],
    ["統制とBCPの高度化", "セキュリティ、監査証跡、災害対策、コスト可視化を継続的に改善する仕組みが求められます。", "rose", "04"],
  ].forEach(([t, b, a, l], i) => card(slide, 0.72 + i * 3.02, 4.0, 2.78, 2.05, t, b, { accent: a, label: l }));
  addDeckFooter(slide, 2);

  slide = newSlide(false, "F2F8FA");
  brand(slide);
  titleBlock(
    slide,
    false,
    "Our Focus",
    "システムソリューションズの3つの支援領域",
    "設計だけ、移行だけ、運用だけで終わらせず、現行調査から構築、移行、改善運用までをつなげます。"
  );
  [
    ["AWSインフラ構築・運用", "ランディングゾーン、ネットワーク、セキュリティ、監視、IaCを標準化し、継続運用に耐える基盤を構築します。\n\n• マルチアカウント設計\n• 監視、ログ、バックアップ\n• 運用自動化と改善", "cyan", "01 Build & Operate"],
    ["クラウド移行支援", "現行資産を棚卸し、移行方式と優先度を整理。PoCから本番移行までリスクを分割して進めます。\n\n• 移行アセスメント\n• 移行ウェーブ計画\n• 切替リハーサル", "green", "02 Migration"],
    ["大規模モダナイゼーション", "レガシー資産を残す領域と刷新する領域を切り分け、段階的に開発速度と保守性を高めます。\n\n• コンテナ、サーバーレス化\n• CI/CD、テスト自動化\n• API、イベント連携", "amber", "03 Modernization"],
  ].forEach(([t, b, a, l], i) => {
    const x = 0.72 + i * 4.02;
    text(slide, l, x + 0.18, 3.14, 1.75, 0.28, { size: 8.7, color: C[a], bold: true, margin: 0 });
    card(slide, x, 3.38, 3.66, 2.95, t, b, { accent: a, bodySize: 9.6 });
  });
  addDeckFooter(slide, 3);

  slide = newSlide(true, C.ink);
  brand(slide, true);
  titleBlock(
    slide,
    true,
    "AWS Foundation",
    "セキュアで運用しやすいAWS基盤を、最初から設計します。",
    "クラウドの自由度を活かしながら、企業利用に必要な統制、可観測性、自動化を設計に組み込みます。"
  );
  [
    ["標準化", "アカウント、ネットワーク、権限、タグ、ログをルール化し、拡張時の迷いを減らします。"],
    ["自動化", "Infrastructure as Codeで再現性を担保し、レビュー可能な変更管理に移行します。"],
    ["運用改善", "監視、障害対応、コスト分析を継続的に見直し、運用の手戻りを減らします。"],
  ].forEach(([h, b], i) => {
    const y = 3.48 + i * 0.82;
    text(slide, h, 0.82, y, 1.05, 0.3, { size: 12, color: C.cyan, bold: true, margin: 0 });
    text(slide, b, 1.9, y, 4.75, 0.42, { size: 10.1, color: C.mutedLight, margin: 0 });
    shape(slide, S.rect, 0.82, y + 0.56, 5.6, 0.01, { fill: "4A5566", line: "4A5566", fillTransparency: 25 });
  });
  [
    ["Landing Zone", "マルチアカウント、統制ポリシー", "cyan"],
    ["Network", "VPC、Transit Gateway、VPN", "green"],
    ["Security", "IAM、WAF、暗号化、監査ログ", "amber"],
    ["Observability", "CloudWatch、ログ集約、通知", "rose"],
    ["Automation", "IaC、CI/CD、パッチ自動化", "violet"],
    ["FinOps", "タグ設計、予算管理、利用分析", "cyan"],
  ].forEach(([t, b, a], i) => card(slide, 7.08 + (i % 2) * 2.66, 2.18 + Math.floor(i / 2) * 1.16, 2.42, 0.94, t, b, { accent: a, dark: true, titleSize: 11, bodySize: 8.8, bodyY: 0.48 }));
  addDeckFooter(slide, 4, true);

  slide = newSlide(false, C.white);
  brand(slide);
  titleBlock(
    slide,
    false,
    "Migration Method",
    "移行方式を見極め、業務停止リスクを分割して進めます。",
    "現行調査、移行方式選定、検証、段階移行、最適化の流れで確実性を高めます。"
  );
  [
    ["現状評価", "サーバー、DB、ネットワーク、運用ジョブ、連携先を棚卸しします。", "cyan"],
    ["移行戦略", "Rehost、Replatform、Refactorなどの方式をシステム単位で整理します。", "green"],
    ["PoC", "性能、セキュリティ、接続、運用手順を小さく検証します。", "amber"],
    ["移行実行", "ウェーブ計画に沿って環境構築、データ移行、切替を進めます。", "rose"],
    ["最適化", "コスト、性能、監視、運用手順を本番運用に合わせて改善します。", "violet"],
  ].forEach(([t, b, a], i) => card(slide, 0.72 + i * 2.5, 3.65, 2.26, 2.22, t, b, { accent: a, label: `${i + 1}`, bodySize: 9.3 }));
  addDeckFooter(slide, 5);

  slide = newSlide(false, "F2F8FA");
  brand(slide);
  titleBlock(
    slide,
    false,
    "Modernization",
    "大規模システムは、段階的にほどいて変化に強くします。",
    "全面刷新のリスクを抑え、業務継続を前提に分割、疎結合化、自動化を進めます。"
  );
  card(slide, 0.9, 3.24, 4.95, 2.8, "Before", "巨大な単一アプリケーション\n手動リリースと環境差分\n密結合なDBとバッチ\n障害影響範囲が広い", { accent: "rose", bodySize: 12 });
  text(slide, "→", 6.18, 4.4, 0.8, 0.62, { size: 33, color: C.cyan, bold: true, align: "center", margin: 0 });
  card(slide, 7.25, 3.24, 4.95, 2.8, "After", "API、サービス単位の分割\nコンテナ、サーバーレス活用\nCI/CDとテスト自動化\n段階リリースと可観測性", { accent: "green", bodySize: 12 });
  addDeckFooter(slide, 6);

  slide = newSlide(true, C.ink);
  brand(slide, true);
  titleBlock(
    slide,
    true,
    "Reference Architecture",
    "AWS標準構成例",
    "可用性、セキュリティ、監視、運用自動化を前提に、ワークロード特性に合わせて構成を選択します。"
  );
  [
    [["利用者", "Web、社内端末、外部システム"], ["接続", "VPN、Direct Connect、PrivateLink"]],
    [["Edge / Security", "CloudFront、WAF、Route 53、ACM"], ["Ingress", "ALB、API Gateway、VPC Endpoint"]],
    [["Compute", "ECS、EKS、Lambda、EC2"], ["Data", "Aurora、RDS、DynamoDB、S3、ElastiCache"]],
    [["Operations", "CloudWatch、CloudTrail、Backup、Systems Manager"], ["Delivery", "IaC、CI/CD、Config、Security Hub"]],
  ].forEach((col, ci) => {
    const x = 0.88 + ci * 3.02;
    shape(slide, S.roundRect, x - 0.08, 3.08, 2.62, 2.58, { fill: "1E2A3A", line: "4A5566", fillTransparency: 10 });
    col.forEach(([t, b], ri) => card(slide, x, 3.28 + ri * 1.08, 2.46, 0.86, t, b, { accent: ["cyan", "green", "amber", "rose"][ci], dark: true, titleSize: 10.5, bodySize: 8.2, bodyY: 0.46 }));
  });
  addDeckFooter(slide, 7, true);

  slide = newSlide(false, C.white);
  brand(slide);
  titleBlock(
    slide,
    false,
    "Delivery Approach",
    "現行調査から改善運用まで、6つのフェーズで推進します。",
    "経営、業務、開発、運用の観点をそろえ、意思決定できる単位に分解して進めます。"
  );
  [
    ["01 Discover\n調査", "資産棚卸し、課題整理、制約条件、関係者ヒアリング", "cyan"],
    ["02 Design\n設計", "AWS構成、移行方式、セキュリティ、運用設計", "green"],
    ["03 Build\n構築", "基盤構築、IaC、監視、CI/CD、検証環境整備", "amber"],
    ["04 Migrate\n移行", "データ移行、切替、リハーサル、性能確認", "rose"],
    ["05 Operate\n運用", "監視、障害対応、バックアップ、変更管理", "violet"],
    ["06 Improve\n改善", "コスト最適化、自動化、SLO改善、追加移行", "cyan"],
  ].forEach(([t, b, a], i) => card(slide, 0.72 + i * 2.05, 3.5, 1.86, 2.34, t, b, { accent: a, titleSize: 11.2, bodySize: 8.8 }));
  addDeckFooter(slide, 8);

  slide = newSlide(false, "F2F8FA");
  brand(slide);
  titleBlock(
    slide,
    false,
    "Business Outcome",
    "技術導入ではなく、事業成果につながる指標で見ます。",
    "初期段階からKPIを置くことで、クラウド移行の投資対効果を説明しやすくします。"
  );
  [
    ["短縮", "環境準備リードタイム", "標準テンプレートとIaCで、検証環境や本番変更を速くします。", "cyan"],
    ["向上", "可用性と復旧力", "冗長化、バックアップ、復旧手順の整備で事業停止リスクを抑えます。", "green"],
    ["削減", "運用の手作業", "監視通知、定型作業、変更適用を自動化し、改善活動に時間を戻します。", "amber"],
    ["可視化", "コストと統制", "タグ、予算、ログ、権限を整備し、説明可能なクラウド利用にします。", "rose"],
  ].forEach(([v, t, b, a], i) => {
    const x = 0.72 + i * 3.02;
    card(slide, x, 3.48, 2.78, 2.25, t, b, { accent: a, bodyY: 1.03 });
    text(slide, v, x + 0.22, 3.78, 2.2, 0.48, { size: 24, color: C[a], bold: true, margin: 0 });
  });
  addDeckFooter(slide, 9);

  slide = newSlide(false, C.white);
  brand(slide);
  titleBlock(
    slide,
    false,
    "Engagement Menu",
    "課題の粒度に合わせて、始めやすい支援メニューを用意します。",
    "初回診断から本格移行、モダナイゼーション、運用改善まで、必要な範囲から着手できます。"
  );
  [
    ["4週間\nクラウド診断", "現行システムを棚卸しし、AWS移行可否、リスク、概算ロードマップを整理します。\n\n• 現状ヒアリング\n• 移行候補分類\n• 優先度と概算計画", "cyan"],
    ["8-12週間\n移行パイロット", "代表システムを選び、AWS構成、移行手順、運用方式を実環境で検証します。\n\n• PoC環境構築\n• 移行リハーサル\n• 本番化判断材料", "green"],
    ["継続支援\nModernization Squad", "アプリ、基盤、運用を横断するチームで、段階的な刷新を推進します。\n\n• サービス分割\n• CI/CD整備\n• 技術負債解消", "amber"],
    ["月次運用\nCloudOps改善", "監視、障害対応、コスト、セキュリティの運用を継続的に改善します。\n\n• 定例レポート\n• 改善バックログ\n• 運用自動化", "rose"],
  ].forEach(([t, b, a], i) => card(slide, 0.72 + i * 3.02, 3.18, 2.78, 2.9, t, b, { accent: a, bodySize: 9.2 }));
  addDeckFooter(slide, 10);

  slide = newSlide(false, "F2F8FA");
  brand(slide);
  titleBlock(
    slide,
    false,
    "Why System Solutions",
    "エンタープライズの現実を踏まえた、実装力のあるクラウド支援。",
    "既存システムを理解し、クラウド設計を実装し、運用に乗せるところまで伴走します。"
  );
  [
    ["PM", "大規模案件の推進設計", "関係者調整、移行計画、リスク管理、意思決定資料の作成まで支援します。", "cyan"],
    ["AWS", "AWSとIaCを前提にした構築力", "再現性のある基盤構築と変更管理で、属人化しにくい運用にします。", "green"],
    ["DX", "レガシーと新技術の橋渡し", "全面刷新に偏らず、残す、移す、作り替えるを現実的に切り分けます。", "amber"],
    ["Ops", "運用移管まで見据えた設計", "監視、障害対応、手順、コスト管理を本番運用に合わせて整備します。", "rose"],
  ].forEach(([label, t, b, a], i) => {
    const x = 0.88 + (i % 2) * 5.95;
    const y = 3.1 + Math.floor(i / 2) * 1.45;
    card(slide, x, y, 5.25, 1.13, t, b, { accent: a, bodyY: 0.6 });
    shape(slide, S.roundRect, x + 0.18, y + 0.32, 0.62, 0.42, { fill: C[a], line: C[a] });
    text(slide, label, x + 0.18, y + 0.42, 0.62, 0.18, { size: 9.4, color: C.white, bold: true, align: "center", margin: 0 });
  });
  addDeckFooter(slide, 11);

  slide = newSlide(true, C.ink);
  brand(slide, true, "Next Action");
  titleBlock(
    slide,
    true,
    "Start Small, Scale Safely",
    "まずは現行システム診断から、AWS活用のロードマップを具体化します。",
    "事業優先度、移行リスク、運用負荷を可視化し、最初の90日で着手すべきテーマを明確にします。"
  );
  [
    ["1. 主要システムの棚卸し", "業務影響、技術制約、保守期限、運用課題を整理します。", "cyan"],
    ["2. 移行優先度の評価", "効果、難易度、リスクをもとに着手順を決めます。", "green"],
    ["3. 30/60/90日計画の策定", "短期で成果を出すPoCと、中長期の刷新ロードマップを分けて設計します。", "amber"],
  ].forEach(([t, b, a], i) => card(slide, 8.1, 2.55 + i * 1.08, 3.95, 0.84, t, b, { accent: a, dark: true, titleSize: 10.5, bodySize: 8.6, bodyY: 0.46 }));
  shape(slide, S.rect, 0.72, 6.15, 6.9, 0.01, { fill: "4A5566", line: "4A5566", fillTransparency: 25 });
  text(slide, "ご提案内容: 現行診断、移行計画、AWS基盤設計、モダナイゼーション推進、CloudOps改善", 0.72, 6.32, 8.2, 0.38, {
    size: 10.2,
    color: C.mutedLight,
    margin: 0,
  });
  addDeckFooter(slide, 12, true);
}

async function main() {
  build();
  await pptx.writeFile({ fileName: OUT });
  console.log(`created ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
