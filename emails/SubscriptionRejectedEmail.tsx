import {
    Body,
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

interface SubscriptionRejectedEmailProps {
    cafeName: string
    ownerName?: string
    tier: "Pro" | "Premium"
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

export default function SubscriptionRejectedEmail({
    cafeName,
    ownerName,
    tier,
    reason,
}: SubscriptionRejectedEmailProps) {
    return (
        <Html>
            <Preview>
                {`Update on your ${tier} subscription payment for "${cafeName}"`}
            </Preview>
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
                                Payment Could Not Be Verified
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {ownerName ? `Hey ${ownerName},` : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                We were unable to verify your payment for the{" "}
                                <strong>{tier}</strong> subscription for{" "}
                                <strong>{cafeName}</strong>.
                            </Text>

                            {reason && (
                                <Section className='bg-tertiary rounded-lg p-4 my-4'>
                                    <Text className='text-text text-sm m-0'>
                                        <strong>Reason:</strong> {reason}
                                    </Text>
                                </Section>
                            )}

                            <Text className='text-text text-base leading-relaxed'>
                                If you believe this is a mistake or have
                                questions about your payment, please contact us
                                at{" "}
                                <a
                                    href='mailto:support@grounds.ph'
                                    className='text-primary'
                                >
                                    support@grounds.ph
                                </a>
                                .
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                You can resubmit your payment anytime from your
                                cafe dashboard.
                            </Text>

                            <Text className='text-secondary text-sm mt-6'>
                                We appreciate your interest in supporting
                                Grounds and hope to resolve this matter quickly.
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
                                payment for a cafe subscription on Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
