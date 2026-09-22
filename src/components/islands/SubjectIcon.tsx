import { BookMarked, Calculator, Compass, FileStack, FlaskConical, Globe2, Landmark, Languages, Leaf, Lightbulb, Monitor, PenLine, Ruler, Sheet } from 'lucide-react';

const icons = {
  english: PenLine,
  maths: Ruler,
  biology: Leaf,
  geography: Globe2,
  chemistry: FlaskConical,
  'history-civics': Landmark,
  'commercial-applications': Calculator,
  'computer-applications': Monitor,
  physics: Lightbulb,
  hindi: Languages,
  'pyq-prelims': FileStack,
  featured: BookMarked,
};

export default function SubjectIcon({ subject }: { subject: string }) {
  const Icon = icons[subject as keyof typeof icons] || BookMarked;
  return <span className="subject-icon" data-subject={subject} aria-hidden="true"><Icon size={19} strokeWidth={1.7} />{subject === 'maths' && <Compass className="subject-icon-companion" size={11} />}{subject === 'commercial-applications' && <Sheet className="subject-icon-companion" size={11} />}</span>;
}
