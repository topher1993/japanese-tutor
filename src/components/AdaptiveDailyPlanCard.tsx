import { StyleSheet, Text, View } from 'react-native';
import type { AdaptiveDailyPlan, AdaptiveDailyPlanTask } from '../services/adaptiveDailyPlanService';
import { ds } from '../theme/designSystem';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';

export function AdaptiveDailyPlanCard({
  plan,
  onTaskPress,
}: {
  plan: AdaptiveDailyPlan;
  onTaskPress: (task: AdaptiveDailyPlanTask) => void;
}) {
  return (
    <Card shadow="card" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><Icon name="today" size={20} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Adaptive daily plan</Text>
          <Text style={styles.title}>{plan.plannedMinutes}-minute personalized session</Text>
          <Text style={styles.subtitle}>{plan.explanation}</Text>
        </View>
        <View style={styles.budget}>
          <Text style={styles.budgetValue}>{plan.budgetMinutes}</Text>
          <Text style={styles.budgetLabel}>min goal</Text>
        </View>
      </View>

      <View style={styles.tasks}>
        {plan.tasks.map((task, index) => (
          <View key={task.id} style={styles.task} testID={`adaptive-plan-task-${task.route}`}>
            <View style={styles.step}><Text style={styles.stepText}>{index + 1}</Text></View>
            <View style={styles.taskCopy}>
              <View style={styles.taskTitleRow}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.minutes}>{task.minutes} min</Text>
              </View>
              <Text style={styles.reason}>{task.reason}</Text>
              <Text style={styles.target}>{task.target} {task.unit}</Text>
              <Button
                label={task.ctaLabel}
                onPress={() => onTaskPress(task)}
                variant="soft"
                size="md"
                fullWidth={false}
                iconRight="arrow-right"
                style={styles.cta}
                testID={`adaptive-plan-cta-${task.route}`}
              />
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.liveHint}>The plan recalculates from current progress whenever you return Home.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: ds.spacing.md, borderLeftWidth: 4, borderLeftColor: ds.colors.success },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: ds.colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.success, textTransform: 'uppercase' },
  title: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  subtitle: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18, marginTop: ds.spacing.xs },
  budget: { alignItems: 'center', backgroundColor: ds.colors.successSoft, borderRadius: ds.radius.md, paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  budgetValue: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.success },
  budgetLabel: { fontSize: ds.type.micro, color: ds.colors.textMuted },
  tasks: { gap: ds.spacing.sm },
  task: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm, borderTopWidth: 1, borderTopColor: ds.colors.divider, paddingTop: ds.spacing.sm },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: ds.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: ds.type.caption, color: ds.colors.brandDark, fontWeight: '900' },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.xs },
  taskTitle: { flex: 1, minWidth: 0, fontSize: ds.type.body, color: ds.colors.text, fontWeight: '900' },
  minutes: { fontSize: ds.type.micro, color: ds.colors.primary, fontWeight: '900', backgroundColor: ds.colors.brandSoft, paddingHorizontal: ds.spacing.xs, paddingVertical: 2, borderRadius: ds.radius.sm },
  reason: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18, marginTop: ds.spacing.xs },
  target: { fontSize: ds.type.micro, color: ds.colors.text, fontWeight: '800', textTransform: 'uppercase', marginTop: ds.spacing.xs },
  cta: { marginTop: ds.spacing.sm, alignSelf: 'flex-start' },
  liveHint: { fontSize: ds.type.micro, color: ds.colors.textMuted, textAlign: 'center' },
});
