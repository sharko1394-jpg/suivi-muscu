import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState, type ReactNode } from 'react';
import { IconGrip } from './icons';

/** L'élément déplacé ne bouge que de haut en bas. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Liste réordonnable par glisser-déposer.
 * On déplace une ligne en la tenant par sa poignée (à gauche) : le reste de la ligne
 * reste disponible pour faire défiler la page ou ouvrir l'élément.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  className = '',
}: {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  /** Dessine une ligne ; `handle` est la poignée à placer dedans. */
  children: (item: T, handle: ReactNode, index: number) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Ordre affiché juste après un déplacement, le temps que la base confirme :
  // sans cela, la ligne reviendrait un instant à son ancienne place.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const savedOrder = items.map((item) => item.id).join('|');
  useEffect(() => setPendingOrder(null), [savedOrder]);

  const ordered = pendingOrder
    ? pendingOrder.flatMap((id) => items.find((item) => item.id === id) ?? [])
    : items;
  const ids = ordered.map((item) => item.id);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setPendingOrder(next);
    onReorder(next);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {ordered.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => children(item, handle, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Déplacer"
      className="flex w-12 shrink-0 touch-none items-center justify-center self-stretch text-muted select-none active:text-ink"
    >
      <IconGrip />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-b border-line/60 bg-surface last:border-b-0 ${
        isDragging ? 'relative z-10 bg-raised shadow-xl shadow-black/60' : ''
      }`}
    >
      {children(handle)}
    </li>
  );
}
