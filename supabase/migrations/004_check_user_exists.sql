CREATE OR REPLACE FUNCTION check_user_exists(p_email text, p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_exists boolean;
  phone_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email) INTO email_exists;
  SELECT EXISTS(SELECT 1 FROM public.users WHERE phone = p_phone) INTO phone_exists;
  
  RETURN json_build_object(
    'email_exists', email_exists,
    'phone_exists', phone_exists
  );
END;
$$;
