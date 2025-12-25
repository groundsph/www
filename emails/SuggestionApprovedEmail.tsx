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

interface SuggestionApprovedEmailProps {
    cafeName: string
    cafeSlug: string
    submitterName?: string
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

export default function SuggestionApprovedEmail({
    cafeName,
    cafeSlug,
    submitterName,
}: SuggestionApprovedEmailProps) {
    const cafeUrl = `${baseUrl}/cafes/${cafeSlug}`

    return (
        <Html>
            <Preview>
                {`Your suggested edit for "${cafeName}" has been approved!`}
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
                                ✨ Your Edit Has Been Approved!
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {submitterName
                                    ? `Hey ${submitterName},`
                                    : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Great news! Your suggested edit for{" "}
                                <strong>{cafeName}</strong> has been reviewed
                                and approved. Your changes are now live on the
                                cafe&apos;s page!
                            </Text>

                            <Section className='text-center my-8'>
                                <Button
                                    href={cafeUrl}
                                    className='bg-primary text-white font-semibold py-3 px-6 rounded-lg no-underline'
                                >
                                    View Updated Cafe
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm'>
                                Thank you for helping keep our cafe information
                                accurate and up-to-date. The community
                                appreciates your contribution!
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
                                You received this email because you suggested an
                                edit on Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
