import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlockValue } from "@/lib/admin/content";
import { BLOCK_MAP } from "@/lib/content/blocks";
import { resetContentAction } from "../../actions";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { ContentForm } from "../../_components/ContentForm";

export async function generateMetadata({ params }: PageProps<"/admin/content/[key]">) {
  const { key } = await params;
  return { title: BLOCK_MAP.get(key)?.label ?? "Content", robots: { index: false, follow: false } };
}

export default async function EditContentPage({ params, searchParams }: PageProps<"/admin/content/[key]">) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const block = BLOCK_MAP.get(key);
  if (!block) notFound();

  const current = await getBlockValue(key);
  if (!current) notFound();

  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{block.label}</h1>
          <p className="adm-sub">
            {block.description}{" "}
            <Link href="/admin/content" className="adm-row-link">
              All content →
            </Link>
          </p>
        </div>
      </div>

      {sp.saved !== undefined && !error && (
        <p className="adm-note" role="status">
          Saved. The website is already showing it.
        </p>
      )}
      {sp.reset !== undefined && (
        <p className="adm-note" role="status">
          Put back to the original wording.
        </p>
      )}
      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}

      <ContentForm
        blockKey={key}
        fields={block.fields}
        value={current.value}
        uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
      />

      {current.edited && (
        <section className="adm-card adm-pad">
          <h2>Start again</h2>
          <p className="adm-stat-note">
            Puts this section back to the wording the site was built with. Nothing else is affected.
          </p>
          <div className="adm-actions">
            <form action={resetContentAction}>
              <input type="hidden" name="key" value={key} />
              <ConfirmSubmit
                label="Restore original wording"
                confirmLabel="Yes, restore it"
                question="Undo your changes to this section?"
                className="adm-btn"
              />
            </form>
          </div>
        </section>
      )}
    </>
  );
}
