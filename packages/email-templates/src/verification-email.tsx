import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface VerificationEmailProps {
  code: string;
  expiresInMinutes?: number;
}

export function VerificationEmail({ code, expiresInMinutes = 10 }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your CoBuild verification code: {code}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center' as const, color: '#1a1a2e' }}>
            Verify your email
          </Heading>
          <Text style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center' as const }}>
            Enter this code to verify your CoBuild account:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
            <Text
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                letterSpacing: '8px',
                color: '#3b82f6',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px 32px',
                display: 'inline-block',
              }}
            >
              {code}
            </Text>
          </Section>
          <Text style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center' as const }}>
            This code expires in {expiresInMinutes} minutes.
          </Text>
          <Text style={{ fontSize: '12px', color: '#d1d5db', textAlign: 'center' as const, marginTop: '40px' }}>
            CoBuild - Enterprise AI Chatbot Platform
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
