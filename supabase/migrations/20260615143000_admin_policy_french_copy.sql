alter table public.app_policy_settings
  alter column consistent_trial_unlock_condition_fr set default 'Maintenir la révision',
  alter column paid_unlock_condition_fr set default 'Accès immédiat',
  alter column high_risk_session_limit_fr set default 'Sessions plus courtes suggérées',
  alter column high_risk_condition_fr set default 'Faible complétion ou faible régularité';

update public.app_policy_settings
set
  consistent_trial_unlock_condition_fr = case
    when consistent_trial_unlock_condition_fr = 'Maintenir la revision'
      then 'Maintenir la révision'
    else consistent_trial_unlock_condition_fr
  end,
  paid_unlock_condition_fr = case
    when paid_unlock_condition_fr = 'Acces immediat'
      then 'Accès immédiat'
    else paid_unlock_condition_fr
  end,
  high_risk_session_limit_fr = case
    when high_risk_session_limit_fr = 'Sessions plus courtes suggerees'
      then 'Sessions plus courtes suggérées'
    else high_risk_session_limit_fr
  end,
  high_risk_condition_fr = case
    when high_risk_condition_fr = 'Faible completion ou faible regularite'
      then 'Faible complétion ou faible régularité'
    else high_risk_condition_fr
  end,
  updated_at = timezone('utc', now())
where id = 'default';
