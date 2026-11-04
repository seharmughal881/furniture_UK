import Link from "next/link";
import { listBlocks } from "@/lib/admin/content";
import { GROUPS } from "@/lib/content/blocks";

export const metadata = { title: "Website content", robots: { index: false, follow: false } };

/** Every editable part of the website, grouped the way the owner thinks about the site. */
export default async function ContentPage() {
  const blocks = await listBlocks();

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Website content</h1>
          <p className="adm-sub">
            Wording, pictures and links across the site. Changes appear straight away — no developer needed.
          </p>
        </div>
      </div>

      {GROUPS.map((group) => {
        const inGroup = blocks.filter((b) => b.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section key={group} className="adm-card" style={{ marginBottom: 16 }}>
            <h2>{group}</h2>
            <ul className="adm-rank">
              {inGroup.map((b) => (
                <li key={b.key}>
                  <span className="adm-rank-name">
                    <Link href={`/admin/content/${b.key}`} className="adm-row-link">
                      {b.label}
                    </Link>
                    <small className="adm-stat-note"> {b.description}</small>
                  </span>
                  <span className="adm-rank-units">
                    {b.edited ? (
                      <>
                        Edited
                        <small className="adm-stat-note">
                          {" "}
                          {b.updatedAt}
                          {b.updatedBy ? ` · ${b.updatedBy}` : ""}
                        </small>
                      </>
                    ) : (
                      <small className="adm-stat-note">Original wording</small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
