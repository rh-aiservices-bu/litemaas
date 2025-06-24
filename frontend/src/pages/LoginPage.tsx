import React from 'react';
import { Button, LoginPage as PFLoginPage } from '@patternfly/react-core';
import { LogoTitle } from '../assets';

const LoginPage: React.FC = () => {
  const handleLogin = () => {
    // Redirect to OpenShift OAuth login
    window.location.href = '/api/auth/login';
  };

  return (
    <PFLoginPage
      brandImgSrc={LogoTitle}
      brandImgAlt="LiteMaaS logo"
      backgroundImgSrc="/bg.jpg"
      textContent="Sign in to your account"
      loginTitle="Log in to LiteMaaS"
      loginSubtitle="Use your OpenShift credentials"
    >
      <Button variant="primary" onClick={handleLogin} isBlock>
        Login with OpenShift
      </Button>
    </PFLoginPage>
  );
};

export default LoginPage;
