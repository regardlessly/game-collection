import PropTypes from 'prop-types';
import styles from './ProgressBar.module.css';

export function ProgressBar({
  value,
  max,
  label,
  showValues = false,
  colorVariant = 'default',
  ariaLabel,
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  const fillClass =
    colorVariant === 'success'
      ? styles.success
      : colorVariant === 'warning'
      ? styles.warning
      : colorVariant === 'danger'
      ? styles.danger
      : '';

  return (
    <div className={styles.container}>
      {(label || showValues) && (
        <div className={styles.label}>
          {label && <span>{label}</span>}
          {showValues && (
            <span>
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel || label || 'Progress'}
      >
        <div
          className={`${styles.fill} ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

ProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  label: PropTypes.string,
  showValues: PropTypes.bool,
  colorVariant: PropTypes.oneOf(['default', 'success', 'warning', 'danger']),
  ariaLabel: PropTypes.string,
};
