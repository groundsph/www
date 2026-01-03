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

interface EventRejectedEmailProps {
    eventTitle: string
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

export default function EventRejectedEmail({
    eventTitle,
    submitterName,
    reason,
}: EventRejectedEmailProps) {
    return (
        <Html>
            <Preview>
                {`Update on your event submission "${eventTitle}"`}
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
                                Event Submission Update
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {submitterName
                                    ? `Hey ${submitterName},`
                                    : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Thank you for your interest in sharing coffee
                                events with the Grounds community.
                                Unfortunately, your event submission{" "}
                                <strong>{eventTitle}</strong> was not approved.
                            </Text>

                            {reason && (
                                <Section className='bg-tertiary rounded-xl p-4 my-4'>
                                    <Text className='text-text text-sm m-0'>
                                        <strong>Reason:</strong> {reason}
                                    </Text>
                                </Section>
                            )}

                            <Text className='text-text text-base leading-relaxed'>
                                Please feel free to submit again with the
                                necessary changes. We appreciate your
                                contribution to the coffee community!
                            </Text>

                            <Text className='text-secondary text-sm mt-6'>
                                If you have any questions, feel free to reach
                                out to us.
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
                                You received this email because you submitted an
                                event to Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
