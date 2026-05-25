import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components"

interface PasswordResetEmailProps {
    resetUrl: string
    email?: string
}

// Custom Tailwind config with Grounds colors (matching global.css)
const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: "#74512d",
                secondary: "#af8f6f",
                tertiary: "#f8f4e1",
                background: "#f8f4e1",
                text: "#543310",
            },
        },
    },
}

export default function PasswordResetEmail({
    resetUrl,
    email,
}: PasswordResetEmailProps) {
    return (
        <Html>
            <Preview>Reset your GroundsPH password</Preview>
            <Tailwind config={tailwindConfig}>
                <Head />
                <Body className='bg-tertiary font-sans'>
                    <Container className='mx-auto py-12 px-4 max-w-xl'>
                        {/* Header */}
                        <Section className='text-center mb-8'>
                            <Heading className='text-4xl font-bold text-primary font-serif m-0'>
                                GroundsPH
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className='bg-white rounded-2xl p-8 shadow-lg'>
                            <Heading className='text-2xl font-semibold text-text mt-0 mb-4'>
                                Reset Your Password
                            </Heading>

                            <Text className='text-text text-base leading-relaxed mb-6'>
                                We received a request to reset the password for
                                the account associated with{" "}
                                {email && (
                                    <span className='font-medium text-text'>
                                        {email}
                                    </span>
                                )}
                                . Click the button below to set a new password.
                            </Text>

                            <Section className='text-center my-8'>
                                <Button
                                    href={resetUrl}
                                    className='bg-primary text-white font-semibold py-4 px-8 rounded-xl text-base no-underline'
                                >
                                    Reset Password
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm leading-relaxed mb-0'>
                                This link will expire in 1 hour. If you
                                didn&apos;t request a password reset, you can
                                safely ignore this email.
                            </Text>
                        </Section>

                        {/* Footer */}
                        <Section className='text-center mt-8'>
                            <Hr className='border-secondary my-6' />
                            <Text className='text-secondary text-sm m-0'>
                                © {new Date().getFullYear()} GroundsPH. All rights
                                reserved.
                            </Text>
                            <Text className='text-secondary text-xs mt-2'>
                                Need help?{" "}
                                <Link
                                    href='mailto:support@grounds.ph'
                                    className='text-primary underline'
                                >
                                    Contact Support
                                </Link>
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
