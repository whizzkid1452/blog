import styles from './account-actions.module.css';

interface AccountActionsProps {
  anonymousLabel: string;
  email?: string | null;
  logoutPath: string;
  signOutLabel: string;
}

export function AccountActions({ anonymousLabel, email, logoutPath, signOutLabel }: AccountActionsProps) {
  return (
    <div className={styles.accountActions}>
      <span className={styles.accountEmail}>{email ?? anonymousLabel}</span>
      <form action={logoutPath} method="post">
        <button className={styles.signOutButton} type="submit">
          {signOutLabel}
        </button>
      </form>
    </div>
  );
}
