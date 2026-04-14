import { AlertTriangle, CalendarDays, Target, Users, Zap } from 'lucide-react';

type IconProps = {
  className?: string;
};

function baseClassName(className?: string) {
  return ['h-5 w-5 text-brand', className].filter(Boolean).join(' ');
}

export function SparkIcon({ className }: IconProps) {
  return <Zap className={baseClassName(className)} aria-hidden="true" strokeWidth={1.9} />;
}

export function TargetIcon({ className }: IconProps) {
  return <Target className={baseClassName(className)} aria-hidden="true" strokeWidth={1.9} />;
}

export function AlertIcon({ className }: IconProps) {
  return <AlertTriangle className={baseClassName(className)} aria-hidden="true" strokeWidth={1.9} />;
}

export function CalendarIcon({ className }: IconProps) {
  return <CalendarDays className={baseClassName(className)} aria-hidden="true" strokeWidth={1.9} />;
}

export function UsersIcon({ className }: IconProps) {
  return <Users className={baseClassName(className)} aria-hidden="true" strokeWidth={1.9} />;
}
