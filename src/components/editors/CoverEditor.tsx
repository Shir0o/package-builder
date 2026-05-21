import type { CoverData } from "../../types";
import { useYText } from "../../lib/useCollabSync";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: CoverData;
  set: (patch: Partial<CoverData>) => void;
};

export function CoverEditor({ blockId, data, set }: Props) {
  const eyebrowY = useYText(blockId, ["eyebrow"]);
  const titleY = useYText(blockId, ["title"]);
  const subtitleY = useYText(blockId, ["subtitle"]);
  const datelineY = useYText(blockId, ["dateline"]);

  const eyebrow = useYTextInput(eyebrowY, data.eyebrow, (v) => set({ eyebrow: v }));
  const title = useYTextInput(titleY, data.title, (v) => set({ title: v }));
  const subtitle = useYTextInput(subtitleY, data.subtitle, (v) => set({ subtitle: v }));
  const dateline = useYTextInput(datelineY, data.dateline, (v) => set({ dateline: v }));

  return (
    <>
      <div className="field">
        <label>Eyebrow (small text above title)</label>
        <input
          type="text"
          ref={eyebrow.ref}
          onChange={eyebrow.onChange}
          placeholder="Church in Santa Ana"
        />
      </div>
      <div className="field">
        <label>Title</label>
        <input
          type="text"
          ref={title.ref}
          onChange={title.onChange}
          placeholder="Title of the packet"
        />
      </div>
      <div className="field">
        <label>Subtitle</label>
        <input
          type="text"
          ref={subtitle.ref}
          onChange={subtitle.onChange}
          placeholder="Optional"
        />
      </div>
      <div className="field">
        <label>Dateline</label>
        <input
          type="text"
          ref={dateline.ref}
          onChange={dateline.onChange}
          placeholder="June 13–22, 2025"
        />
      </div>
    </>
  );
}
