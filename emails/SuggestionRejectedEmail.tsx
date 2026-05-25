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

interface SuggestionRejectedEmailProps {
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

export default function SuggestionRejectedEmail({
    cafeName,
    submitterName,
    reason,
}: SuggestionRejectedEmailProps) {
    return (
        <Html>
            <Preview>
                {`Update on your suggested edit for "${cafeName}"`}
            </Preview>
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
                                Edit Suggestion Update
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {submitterName
                                    ? `Hey ${submitterName},`
                                    : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Thank you for taking the time to suggest an edit
                                for <strong>{cafeName}</strong>. After careful
                                review, we were unable to apply your suggested
                                changes at this time.
                            </Text>

                            {reason && (
                                <Section className='bg-tertiary rounded-xl p-4 my-4'>
                                    <Text className='text-text text-sm m-0'>
                                        <strong>Reason:</strong> {reason}
                                    </Text>
                                </Section>
                            )}

                            <Text className='text-text text-base leading-relaxed'>
                                This could be due to various reasons such as
                                conflicting information, duplicate changes, or
                                our moderation guidelines.
                            </Text>

                            <Text className='text-secondary text-sm'>
                                We still appreciate your effort in helping
                                improve the GroundsPH community. Feel free to
                                submit another suggestion with updated
                                information!
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
                                You received this email because you suggested an
                                edit on GroundsPH.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
