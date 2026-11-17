import { Layer, Group, Circle, Text } from "react-konva";
import type { Comment } from "../../api/comments";
import { useCommentStore } from "../../store/commentStore";

interface Props {
  comments: Comment[];
  // Current stage zoom. Pins are divided by this so they stay the same
  // on-screen size while the canvas zooms.
  scale?: number;
}

// Top-level comments that are pinned to the canvas, in creation order.
// The sidebar should number threads with the same list so the numbers match.
export function getPinned(comments: Comment[]) {
  return comments.filter(
    (c) => c.parent_id === null && c.x !== null && c.y !== null,
  );
}

export function CommentPins({ comments, scale = 1 }: Props) {
  const activeId = useCommentStore((s) => s.activeCommentId);
  const draftPin = useCommentStore((s) => s.draftPin);
  const setActive = useCommentStore((s) => s.setActiveComment);

  const pins = getPinned(comments).filter((c) => !c.resolved);
  const r = 12 / scale;

  const setCursor = (e: any, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Layer>
      {pins.map((c, i) => {
        const isActive = c.id === activeId;
        const fill = c.resolved ? "#9ca3af" : isActive ? "#2563eb" : "#ef4444";
        return (
          <Group
            key={c.id}
            x={c.x as number}
            y={c.y as number}
            // Stop the click from reaching the Stage, which would drop a new draft pin
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              setActive(c.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setActive(c.id);
            }}
            onMouseEnter={(e) => setCursor(e, "pointer")}
            onMouseLeave={(e) => setCursor(e, "default")}
          >
            <Circle
              radius={isActive ? r * 1.2 : r}
              fill={fill}
              stroke="#ffffff"
              strokeWidth={2 / scale}
            />
            <Text
              text={String(i + 1)}
              fontSize={12 / scale}
              fontStyle="bold"
              fill="#ffffff"
              width={r * 2}
              height={r * 2}
              offsetX={r}
              offsetY={r}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
        );
      })}

      {/* Pin that is being placed but not yet submitted */}
      {draftPin && (
        <Group x={draftPin.x} y={draftPin.y} listening={false}>
          <Circle
            radius={r}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2 / scale}
            dash={[4 / scale, 3 / scale]}
          />
          <Text
            text="+"
            fontSize={16 / scale}
            fill="#2563eb"
            width={r * 2}
            height={r * 2}
            offsetX={r}
            offsetY={r}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </Layer>
  );
}
