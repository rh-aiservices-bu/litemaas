import React from 'react';
import { Button, LoginPage as PFLoginPage, Stack, StackItem, Divider } from '@patternfly/react-core';
import { ExternalLinkAltIcon, UserIcon } from '@patternfly/react-icons';
import { LogoTitle } from '../assets';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, loginAsAdmin } = useAuth();

  const handleLogin = () => {
    login();
  };

  return (
    <PFLoginPage
      brandImgSrc={LogoTitle}
      brandImgAlt="LiteMaaS logo"
      backgroundImgSrc="/bg.jpg"
      textContent="Sign in to your account"
      loginTitle="Log in to LiteMaaS"
      loginSubtitle="Use your OpenShift credentials or bypass for testing"
    >
      <Stack hasGutter>
        <StackItem>
          <Button 
            variant="primary" 
            onClick={handleLogin} 
            isBlock
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
          >
            Login with OpenShift
          </Button>
        </StackItem>
        
        <StackItem>
          <div className="pf-v6-u-text-align-center pf-v6-u-my-md">
            <Divider />
            <div className="pf-v6-u-mt-sm">
              <small className="pf-v6-u-color-400">Development Mode</small>
            </div>
          </div>
        </StackItem>

        <StackItem>
          <Button 
            variant="secondary" 
            onClick={loginAsAdmin} 
            isBlock
            icon={<UserIcon />}
            iconPosition="start"
          >
            Login as Admin (Test)
          </Button>
          <div className="pf-v6-u-text-align-center pf-v6-u-mt-sm">
            <small className="pf-v6-u-color-400">
              Bypass authentication for development and testing purposes
            </small>
          </div>
        </StackItem>
      </Stack>
    </PFLoginPage>
  );
};

export default LoginPage;
