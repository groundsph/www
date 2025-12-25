import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components"

interface CafeRejectedEmailProps {
    cafeName: string
    submitterName?: string
    reason?: string
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

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

export default function CafeRejectedEmail({
    cafeName,
    submitterName,
    reason,
}: CafeRejectedEmailProps) {
    const submitUrl = `${baseUrl}/submit`

    return (
        <Html>
            <Preview>{`Update on your cafe submission "${cafeName}"`}</Preview>
            <Tailwind config={tailwindConfig}>
                <Head />
                <Body className='bg-tertiary font-sans'>
                    <Container className='mx-auto py-12 px-4 max-w-xl'>
                        {/* Header */}
                        <Section className='text-center mb-8'>
                            <Heading className='text-4xl font-bold text-primary font-serif m-0'>
                                Grounds
                                <span className='text-secondary'>.</span>
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className='bg-white rounded-2xl p-8 shadow-lg'>
                            <Heading className='text-2xl font-semibold text-text mt-0 mb-4'>
                                Regarding Your Cafe Submission
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {submitterName
                                    ? `Hey ${submitterName},`
                                    : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Thank you for submitting{" "}
                                <strong>{cafeName}</strong> to Grounds. After
                                careful review, we were unable to approve this
                                submission at this time.
                            </Text>

                            {reason && (
                                <Section className='bg-tertiary rounded-lg p-4 my-4'>
                                    <Text className='text-secondary text-sm mb-1 mt-0'>
                                        Reason
                                    </Text>
                                    <Text className='text-text text-base m-0'>
                                        {reason}
                                    </Text>
                                </Section>
                            )}

                            <Text className='text-text text-base leading-relaxed'>
                                This could be due to incomplete information,
                                duplicate entries, or the cafe not meeting our
                                listing criteria. We encourage you to review the
                                submission guidelines and try again.
                            </Text>

                            <Section className='text-center my-8'>
                                <Button
                                    href={submitUrl}
                                    className='bg-primary text-white font-semibold py-3 px-6 rounded-lg no-underline'
                                >
                                    Submit Another Cafe
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm'>
                                If you believe this was a mistake or have
                                questions, feel free to reach out to us through
                                our contact page.
                            </Text>
                        </Section>

                        {/* Footer */}
                        <Section className='text-center mt-8'>
                            <Hr className='border-secondary my-6' />
                            <Text className='text-secondary text-sm m-0'>
                                © {new Date().getFullYear()} Grounds. All rights
                                reserved.
                            </Text>
                            <Text className='text-secondary text-xs mt-2'>
                                You received this email because you submitted a
                                cafe to Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
