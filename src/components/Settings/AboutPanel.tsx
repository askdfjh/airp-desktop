import { ExternalLink, Gift, Scale, ShieldAlert } from "lucide-react";
import { ComplianceNotice } from "./ComplianceNotice";

const legalRiskItems = [
  "违法或违规内容：不要生成、传播、协助制作违法信息，或用本软件规避平台、安全与内容治理规则。",
  "个人信息与隐私：导入、同步、发送他人个人信息前，应确认有合法来源、必要目的和相应授权。",
  "著作权与知识产权：上传、改写、生成、导出作品时，应避免侵犯他人著作权、商标权、肖像权或其他权益。",
  "数据与云同步：启用 WebDAV、第三方模型、联网搜索或 MCP 后，相关内容可能离开本机并由外部服务处理。",
  "外部工具调用：MCP 与搜索工具可能访问网络、读取外部数据或调用第三方服务，请只连接可信服务。",
  "专业建议边界：涉及法律、医疗、金融、未成年人保护等高风险事项时，请以专业机构或主管部门意见为准。",
];

const references = [
  { label: "《生成式人工智能服务管理暂行办法》", href: "https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm" },
  { label: "《中华人民共和国个人信息保护法》", href: "https://www.npc.gov.cn/npc/c30834/202108/a8c4e3672c74491a80b53a172bb753fe.shtml" },
  { label: "《中华人民共和国著作权法》", href: "https://www.npc.gov.cn/npc/c2/c30834/202011/t20201111_308842.html" },
  { label: "《中华人民共和国网络安全法》", href: "https://www.npc.gov.cn/zgrdw/npc/xinwen/2016-11/07/content_2001605.htm" },
];

export function AboutPanel() {
  return (
    <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: 22, borderRadius: 22, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 18, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--seed-accent)", flexShrink: 0 }}>
            <Scale size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--seed-fg)", marginBottom: 3 }}>关于灵叙 Narra</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--seed-muted)" }}>
              本软件是本地运行的 AI 创作与对话工具，支持桌面端和移动端共用数据结构与界面能力。
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ padding: 16, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "var(--success)" }}>
            <Gift size={15} />
            <span style={{ fontSize: 13, fontWeight: 650, color: "var(--seed-fg)" }}>软件本体免费</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--seed-muted)" }}>
            本软件本体供免费使用；你自行配置的模型 API、搜索 API、WebDAV 云盘、MCP 服务或网络流量，可能由对应第三方服务按其规则收费。
          </div>
        </div>

        <div style={{ padding: 16, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "var(--warning)" }}>
            <ShieldAlert size={15} />
            <span style={{ fontSize: 13, fontWeight: 650, color: "var(--seed-fg)" }}>外联能力需留意</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--seed-muted)" }}>
            不启用第三方模型、搜索、云同步或 MCP 时，主要数据保存在本机；启用后，请按外部服务的隐私政策、服务条款和计费规则判断是否适合使用。
          </div>
        </div>
      </div>

      <ComplianceNotice title="中国法律风险提示">
        下列内容仅作使用提醒，不构成法律意见；如果用途涉及经营、公开发布、收费服务或处理敏感数据，请先自行核验合规要求。
      </ComplianceNotice>

      <div style={{ padding: 18, borderRadius: 20, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: "var(--seed-fg)", marginBottom: 12 }}>使用时需要特别注意</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {legalRiskItems.map((item, idx) => (
            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--seed-muted)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--seed-fg)", marginBottom: 10 }}>参考法规</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {references.map((ref) => (
            <a
              key={ref.href}
              href={ref.href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--seed-border)",
                background: "var(--seed-hover-bg)",
                color: "var(--seed-muted)",
                textDecoration: "none",
                fontSize: 11,
              }}
            >
              {ref.label}
              <ExternalLink size={10} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
