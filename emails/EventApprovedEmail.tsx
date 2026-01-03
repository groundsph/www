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

interface EventApprovedEmailProps {
    eventTitle: string
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

export default function EventApprovedEmail({
    eventTitle,
    submitterName,
}: EventApprovedEmailProps) {
    const communityUrl = `${baseUrl}/community`

    return (
        <Html>
            <Preview>
                {`Great news! Your event "${eventTitle}" has been approved!`}
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
                                🎉 Your Event Has Been Approved!
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {submitterName
                                    ? `Hey ${submitterName},`
                                    : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Great news! Your event submission{" "}
                                <strong>{eventTitle}</strong> has been reviewed
                                and approved. It is now live on Grounds and can
                                be discovered by coffee lovers everywhere!
                            </Text>

                            <Section className='text-center my-8'>
                                <Button
                                    href={communityUrl}
                                    className='bg-primary text-white font-semibold py-3 px-6 rounded-lg no-underline'
                                >
                                    View Events
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm'>
                                Thank you for contributing to the Grounds
                                community. Your help in sharing coffee events is
                                greatly appreciated!
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
